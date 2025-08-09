#!/usr/bin/env node

/**
 * Health check script for InvestMTL API endpoints
 * Validates API response times, data integrity, and service availability
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

class HealthChecker {
  constructor(baseUrl = 'http://localhost:8787/api', timeout = 10000) {
    this.baseUrl = baseUrl;
    this.timeout = timeout;
    this.results = {
      timestamp: new Date().toISOString(),
      baseUrl: baseUrl,
      totalChecks: 0,
      passedChecks: 0,
      failedChecks: 0,
      checks: [],
      errors: [],
      warnings: [],
      summary: {}
    };
  }

  async makeRequest(path, options = {}) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.baseUrl);
      const isHttps = url.protocol === 'https:';
      const lib = isHttps ? https : http;
      
      const requestOptions = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method: options.method || 'GET',
        timeout: this.timeout,
        headers: {
          'User-Agent': 'InvestMTL-HealthCheck/1.0',
          'Accept': 'application/json',
          ...options.headers
        }
      };

      const startTime = Date.now();
      
      const req = lib.request(requestOptions, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          const responseTime = Date.now() - startTime;
          
          try {
            const jsonData = data ? JSON.parse(data) : null;
            resolve({
              statusCode: res.statusCode,
              headers: res.headers,
              data: jsonData,
              responseTime: responseTime,
              rawData: data
            });
          } catch (parseError) {
            resolve({
              statusCode: res.statusCode,
              headers: res.headers,
              data: null,
              responseTime: responseTime,
              rawData: data,
              parseError: parseError.message
            });
          }
        });
      });

      req.on('error', (error) => {
        reject({
          error: error.message,
          code: error.code,
          responseTime: Date.now() - startTime
        });
      });

      req.on('timeout', () => {
        req.destroy();
        reject({
          error: 'Request timeout',
          code: 'TIMEOUT',
          responseTime: this.timeout
        });
      });

      if (options.body) {
        req.write(JSON.stringify(options.body));
      }

      req.end();
    });
  }

  async checkEndpoint(name, path, expectedStatus = 200, validator = null) {
    console.log(`Checking ${name}...`);
    
    const check = {
      name: name,
      path: path,
      status: 'unknown',
      responseTime: 0,
      statusCode: null,
      error: null,
      warnings: []
    };

    this.results.totalChecks++;

    try {
      const response = await this.makeRequest(path);
      
      check.responseTime = response.responseTime;
      check.statusCode = response.statusCode;

      if (response.statusCode === expectedStatus) {
        if (validator) {
          const validationResult = validator(response.data);
          if (validationResult.isValid) {
            check.status = 'passed';
            this.results.passedChecks++;
          } else {
            check.status = 'failed';
            check.error = `Validation failed: ${validationResult.error}`;
            this.results.failedChecks++;
          }
          check.warnings = validationResult.warnings || [];
        } else {
          check.status = 'passed';
          this.results.passedChecks++;
        }

        // Performance warnings
        if (response.responseTime > 5000) {
          check.warnings.push('Slow response time (>5s)');
        } else if (response.responseTime > 2000) {
          check.warnings.push('Moderate response time (>2s)');
        }

      } else {
        check.status = 'failed';
        check.error = `Expected status ${expectedStatus}, got ${response.statusCode}`;
        this.results.failedChecks++;
      }

      if (response.parseError) {
        check.warnings.push(`JSON parse warning: ${response.parseError}`);
      }

    } catch (error) {
      check.status = 'failed';
      check.error = error.error || 'Request failed';
      check.responseTime = error.responseTime || 0;
      this.results.failedChecks++;
    }

    this.results.checks.push(check);
    
    const statusSymbol = check.status === 'passed' ? '✅' : '❌';
    const warningText = check.warnings.length > 0 ? ` ⚠️  ${check.warnings.join(', ')}` : '';
    console.log(`  ${statusSymbol} ${name} (${check.responseTime}ms)${warningText}`);
    
    return check;
  }

  // Validator functions
  zonesValidator(data) {
    if (!data || !Array.isArray(data.zones)) {
      return { isValid: false, error: 'Response should contain zones array' };
    }
    
    const warnings = [];
    if (data.zones.length < 10) {
      warnings.push(`Low zone count: ${data.zones.length}`);
    }

    // Check first zone structure
    if (data.zones.length > 0) {
      const firstZone = data.zones[0];
      const requiredFields = ['zone_id', 'zone_name', 'investment_score'];
      const missingFields = requiredFields.filter(field => !firstZone.hasOwnProperty(field));
      
      if (missingFields.length > 0) {
        return { isValid: false, error: `Missing required fields: ${missingFields.join(', ')}` };
      }
    }

    return { isValid: true, warnings };
  }

  singleZoneValidator(data) {
    if (!data || !data.zone) {
      return { isValid: false, error: 'Response should contain zone object' };
    }

    const zone = data.zone;
    const requiredFields = ['zone_id', 'zone_name', 'investment_score'];
    const missingFields = requiredFields.filter(field => !zone.hasOwnProperty(field));

    if (missingFields.length > 0) {
      return { isValid: false, error: `Missing required fields: ${missingFields.join(', ')}` };
    }

    const warnings = [];
    if (zone.investment_score < 0 || zone.investment_score > 100) {
      warnings.push('Investment score out of valid range (0-100)');
    }

    return { isValid: true, warnings };
  }

  predictionsValidator(data) {
    if (!data || !Array.isArray(data.predictions)) {
      return { isValid: false, error: 'Response should contain predictions array' };
    }

    const warnings = [];
    if (data.predictions.length === 0) {
      warnings.push('No predictions available');
    }

    if (data.predictions.length > 0) {
      const firstPrediction = data.predictions[0];
      const requiredFields = ['zone_id', 'predicted_price', 'predicted_rent'];
      const missingFields = requiredFields.filter(field => !firstPrediction.hasOwnProperty(field));

      if (missingFields.length > 0) {
        return { isValid: false, error: `Missing required fields: ${missingFields.join(', ')}` };
      }
    }

    return { isValid: true, warnings };
  }

  summaryValidator(data) {
    if (!data) {
      return { isValid: false, error: 'No summary data received' };
    }

    const requiredFields = ['total_zones', 'avg_predicted_price', 'avg_predicted_rent'];
    const missingFields = requiredFields.filter(field => !data.hasOwnProperty(field));

    if (missingFields.length > 0) {
      return { isValid: false, error: `Missing required fields: ${missingFields.join(', ')}` };
    }

    const warnings = [];
    if (data.total_zones < 10) {
      warnings.push(`Low zone count in summary: ${data.total_zones}`);
    }

    return { isValid: true, warnings };
  }

  async runAllChecks() {
    console.log(`\n🏥 InvestMTL API Health Check`);
    console.log(`Base URL: ${this.baseUrl}`);
    console.log(`Timeout: ${this.timeout}ms\n`);

    // Core API endpoints
    await this.checkEndpoint('Zones List', '/zones', 200, this.zonesValidator.bind(this));
    await this.checkEndpoint('Single Zone', '/zones/MTL001', 200, this.singleZoneValidator.bind(this));
    await this.checkEndpoint('Zone Not Found', '/zones/INVALID', 404);
    
    // Predictions endpoints
    await this.checkEndpoint('Predictions List', '/predictions', 200, this.predictionsValidator.bind(this));
    await this.checkEndpoint('Predictions Summary', '/predictions/summary', 200, this.summaryValidator.bind(this));
    await this.checkEndpoint('Zone Prediction', '/predictions/zones/MTL001', 200);

    // Search and filter endpoints
    await this.checkEndpoint('Search Zones', '/zones?search=downtown', 200, this.zonesValidator.bind(this));
    await this.checkEndpoint('Filter by Borough', '/zones?borough=Ville-Marie', 200, this.zonesValidator.bind(this));
    
    // Authentication endpoints (should return appropriate errors without auth)
    await this.checkEndpoint('Auth Required - Favorites', '/favorites', 401);
    await this.checkEndpoint('Auth Required - Export', '/export/zones/csv', 401);

    // Generate summary
    this.generateSummary();
    
    return this.results;
  }

  generateSummary() {
    const totalTime = this.results.checks.reduce((sum, check) => sum + check.responseTime, 0);
    const avgResponseTime = totalTime / this.results.checks.length;
    
    const slowChecks = this.results.checks.filter(check => check.responseTime > 2000);
    const failedChecks = this.results.checks.filter(check => check.status === 'failed');
    const warningChecks = this.results.checks.filter(check => check.warnings.length > 0);

    this.results.summary = {
      overallHealth: this.results.failedChecks === 0 ? 'healthy' : 'unhealthy',
      successRate: ((this.results.passedChecks / this.results.totalChecks) * 100).toFixed(1),
      avgResponseTime: Math.round(avgResponseTime),
      slowEndpoints: slowChecks.length,
      failedEndpoints: failedChecks.length,
      warningEndpoints: warningChecks.length
    };

    // Collect all warnings and errors
    this.results.warnings = this.results.checks
      .filter(check => check.warnings.length > 0)
      .map(check => ({ endpoint: check.name, warnings: check.warnings }));
    
    this.results.errors = failedChecks.map(check => ({
      endpoint: check.name,
      error: check.error,
      statusCode: check.statusCode
    }));
  }

  printSummary() {
    const summary = this.results.summary;
    
    console.log('\n📊 Health Check Summary');
    console.log('========================');
    console.log(`Overall Health: ${summary.overallHealth === 'healthy' ? '🟢' : '🔴'} ${summary.overallHealth.toUpperCase()}`);
    console.log(`Success Rate: ${summary.successRate}% (${this.results.passedChecks}/${this.results.totalChecks})`);
    console.log(`Average Response Time: ${summary.avgResponseTime}ms`);
    console.log(`Failed Endpoints: ${summary.failedEndpoints}`);
    console.log(`Slow Endpoints (>2s): ${summary.slowEndpoints}`);
    console.log(`Endpoints with Warnings: ${summary.warningEndpoints}`);

    if (this.results.errors.length > 0) {
      console.log('\n❌ Errors:');
      this.results.errors.forEach(error => {
        console.log(`  • ${error.endpoint}: ${error.error}`);
      });
    }

    if (this.results.warnings.length > 0) {
      console.log('\n⚠️  Warnings:');
      this.results.warnings.forEach(warning => {
        console.log(`  • ${warning.endpoint}: ${warning.warnings.join(', ')}`);
      });
    }

    console.log('');
  }

  saveResults(filename) {
    const fs = require('fs');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const defaultFilename = `health-check-${timestamp}.json`;
    
    fs.writeFileSync(filename || defaultFilename, JSON.stringify(this.results, null, 2));
    console.log(`Results saved to ${filename || defaultFilename}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  // Parse command line arguments
  let baseUrl = 'http://localhost:8787/api';
  let production = false;
  let saveToFile = false;
  let filename = null;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--production':
      case '-p':
        production = true;
        baseUrl = 'https://investmtl.your-domain.workers.dev/api';
        break;
      case '--url':
      case '-u':
        if (i + 1 < args.length) {
          baseUrl = args[++i];
        }
        break;
      case '--save':
      case '-s':
        saveToFile = true;
        if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
          filename = args[++i];
        }
        break;
      case '--help':
      case '-h':
        console.log(`
InvestMTL API Health Check

Usage: node health_check.js [options]

Options:
  --production, -p     Use production API URL
  --url <url>, -u      Custom API base URL
  --save [file], -s    Save results to JSON file
  --help, -h           Show this help message

Examples:
  node health_check.js --production
  node health_check.js --url http://localhost:3000/api
  node health_check.js --save results.json
        `);
        process.exit(0);
    }
  }

  const checker = new HealthChecker(baseUrl);
  
  try {
    await checker.runAllChecks();
    checker.printSummary();
    
    if (saveToFile) {
      checker.saveResults(filename);
    }
    
    // Exit with error code if any checks failed
    const exitCode = checker.results.failedChecks > 0 ? 1 : 0;
    process.exit(exitCode);
    
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = HealthChecker;
