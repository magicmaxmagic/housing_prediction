import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { jwt } from 'hono/jwt';

const app = new Hono<{
  Bindings: {
    DB: D1Database;
    JWT_SECRET: string;
  };
  Variables: {
    user: {
      id: number;
      email: string;
    };
  };
}>();

// CORS middleware
app.use('*', cors());

// JWT middleware for protected routes
app.use('/api/export/*', jwt({
  secret: (c) => c.env.JWT_SECRET,
  cookie: false
}));

// Parse JWT and add user to context
app.use('/api/export/*', async (c, next) => {
  const payload = c.get('jwtPayload') as any;
  if (!payload?.user) {
    return c.json({ message: 'Invalid token' }, 401);
  }
  c.set('user', payload.user);
  await next();
});

// Export zones data as CSV
app.get('/api/export/zones/csv', async (c) => {
  try {
    const { format = 'all', zones } = c.req.query();
    
    let whereClause = '';
    let params: any[] = [];
    
    if (zones) {
      const zoneIds = zones.split(',').map(id => id.trim()).filter(Boolean);
      if (zoneIds.length > 0) {
        whereClause = `WHERE z.zone_id IN (${zoneIds.map(() => '?').join(',')})`;
        params = zoneIds;
      }
    }

    const query = `
      SELECT 
        z.zone_id,
        z.zone_name,
        z.borough,
        z.investment_score,
        z.avg_price_per_sqft,
        z.avg_rent_per_sqft,
        z.avg_annual_return,
        z.total_properties,
        z.avg_property_age,
        z.crime_rate,
        z.walkability_score,
        z.transit_score,
        z.school_rating,
        z.green_space_ratio,
        z.employment_rate,
        z.population_density,
        z.median_income,
        z.updated_at,
        p.predicted_price,
        p.predicted_rent,
        p.price_confidence_min,
        p.price_confidence_max,
        p.rent_confidence_min,
        p.rent_confidence_max,
        p.prediction_date
      FROM zones z
      LEFT JOIN predictions p ON z.zone_id = p.zone_id
      ${whereClause}
      ORDER BY z.investment_score DESC
    `;

    const { results } = await c.env.DB.prepare(query).bind(...params).all();

    if (!results || results.length === 0) {
      return c.json({ message: 'No data found' }, 404);
    }

    // Create CSV content
    const headers = [
      'Zone ID', 'Zone Name', 'Borough', 'Investment Score',
      'Avg Price/sq ft', 'Avg Rent/sq ft', 'Annual Return %',
      'Total Properties', 'Avg Property Age', 'Crime Rate',
      'Walkability Score', 'Transit Score', 'School Rating',
      'Green Space %', 'Employment Rate', 'Population Density',
      'Median Income', 'Last Updated', 'Predicted Price',
      'Predicted Rent', 'Price Confidence Min', 'Price Confidence Max',
      'Rent Confidence Min', 'Rent Confidence Max', 'Prediction Date'
    ];

    let csv = headers.join(',') + '\n';
    
    results.forEach((row: any) => {
      const values = [
        row.zone_id,
        `"${row.zone_name}"`,
        `"${row.borough}"`,
        row.investment_score || '',
        row.avg_price_per_sqft || '',
        row.avg_rent_per_sqft || '',
        row.avg_annual_return || '',
        row.total_properties || '',
        row.avg_property_age || '',
        row.crime_rate || '',
        row.walkability_score || '',
        row.transit_score || '',
        row.school_rating || '',
        row.green_space_ratio || '',
        row.employment_rate || '',
        row.population_density || '',
        row.median_income || '',
        row.updated_at || '',
        row.predicted_price || '',
        row.predicted_rent || '',
        row.price_confidence_min || '',
        row.price_confidence_max || '',
        row.rent_confidence_min || '',
        row.rent_confidence_max || '',
        row.prediction_date || ''
      ];
      csv += values.join(',') + '\n';
    });

    const filename = zones ? 
      `montreal-zones-custom-${new Date().toISOString().split('T')[0]}.csv` :
      `montreal-zones-all-${new Date().toISOString().split('T')[0]}.csv`;

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    console.error('Export CSV error:', error);
    return c.json({ 
      message: 'Failed to export data',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Export user favorites as CSV
app.get('/api/export/favorites/csv', async (c) => {
  try {
    const user = c.get('user');
    
    const query = `
      SELECT 
        f.id,
        f.zone_id,
        f.notes,
        f.added_at,
        z.zone_name,
        z.borough,
        z.investment_score,
        z.avg_price_per_sqft,
        z.avg_rent_per_sqft,
        z.avg_annual_return,
        p.predicted_price,
        p.predicted_rent,
        p.price_confidence_min,
        p.price_confidence_max,
        p.rent_confidence_min,
        p.rent_confidence_max
      FROM user_favorites f
      JOIN zones z ON f.zone_id = z.zone_id
      LEFT JOIN predictions p ON z.zone_id = p.zone_id
      WHERE f.user_id = ?
      ORDER BY f.added_at DESC
    `;

    const { results } = await c.env.DB.prepare(query).bind(user.id).all();

    if (!results || results.length === 0) {
      return c.json({ message: 'No favorites found' }, 404);
    }

    // Create CSV content
    const headers = [
      'Zone ID', 'Zone Name', 'Borough', 'Investment Score',
      'Avg Price/sq ft', 'Avg Rent/sq ft', 'Annual Return %',
      'Predicted Price', 'Predicted Rent', 
      'Price Confidence Min', 'Price Confidence Max',
      'Rent Confidence Min', 'Rent Confidence Max',
      'Personal Notes', 'Added Date'
    ];

    let csv = headers.join(',') + '\n';
    
    results.forEach((row: any) => {
      const values = [
        row.zone_id,
        `"${row.zone_name}"`,
        `"${row.borough}"`,
        row.investment_score || '',
        row.avg_price_per_sqft || '',
        row.avg_rent_per_sqft || '',
        row.avg_annual_return || '',
        row.predicted_price || '',
        row.predicted_rent || '',
        row.price_confidence_min || '',
        row.price_confidence_max || '',
        row.rent_confidence_min || '',
        row.rent_confidence_max || '',
        `"${row.notes || ''}"`,
        row.added_at || ''
      ];
      csv += values.join(',') + '\n';
    });

    const filename = `my-favorites-${new Date().toISOString().split('T')[0]}.csv`;

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    console.error('Export favorites CSV error:', error);
    return c.json({ 
      message: 'Failed to export favorites',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Generate PDF report (simplified - would need PDF library in production)
app.get('/api/export/report/pdf', async (c) => {
  try {
    const user = c.get('user');
    const { zones, type = 'summary' } = c.req.query();
    
    // For now, return HTML content that can be printed as PDF
    // In production, you'd use a PDF library like puppeteer or jsPDF
    
    let whereClause = '';
    let params: any[] = [];
    
    if (zones) {
      const zoneIds = zones.split(',').map(id => id.trim()).filter(Boolean);
      if (zoneIds.length > 0) {
        whereClause = `WHERE z.zone_id IN (${zoneIds.map(() => '?').join(',')})`;
        params = zoneIds;
      }
    }

    const query = `
      SELECT 
        z.*,
        p.predicted_price,
        p.predicted_rent,
        p.price_confidence_min,
        p.price_confidence_max,
        p.rent_confidence_min,
        p.rent_confidence_max,
        p.prediction_date
      FROM zones z
      LEFT JOIN predictions p ON z.zone_id = p.zone_id
      ${whereClause}
      ORDER BY z.investment_score DESC
      LIMIT 50
    `;

    const { results } = await c.env.DB.prepare(query).bind(...params).all();

    if (!results || results.length === 0) {
      return c.json({ message: 'No data found' }, 404);
    }

    const html = generateReportHTML(results as any[], user, type);

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html',
        'Content-Disposition': `inline; filename="montreal-real-estate-report-${new Date().toISOString().split('T')[0]}.html"`,
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    console.error('Export PDF error:', error);
    return c.json({ 
      message: 'Failed to generate report',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Get export history for user
app.get('/api/export/history', async (c) => {
  try {
    const user = c.get('user');
    
    const query = `
      SELECT 
        export_type,
        created_at,
        parameters,
        file_size
      FROM export_history 
      WHERE user_id = ? 
      ORDER BY created_at DESC 
      LIMIT 20
    `;

    const { results } = await c.env.DB.prepare(query).bind(user.id).all();

    return c.json({ 
      exports: results || [],
      message: 'Export history retrieved successfully'
    });
  } catch (error) {
    console.error('Get export history error:', error);
    return c.json({ 
      message: 'Failed to get export history',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Helper function to generate HTML report
function generateReportHTML(zones: any[], user: any, reportType: string): string {
  const now = new Date().toLocaleString();
  const topZones = zones.slice(0, 10);
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Montreal Real Estate Investment Report</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
        .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #333; padding-bottom: 20px; }
        .summary { background: #f5f5f5; padding: 20px; margin: 20px 0; border-radius: 5px; }
        .zone { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
        .zone h3 { margin: 0 0 10px 0; color: #333; }
        .metrics { display: flex; justify-content: space-between; flex-wrap: wrap; }
        .metric { margin: 5px 0; }
        .score-high { color: #10B981; }
        .score-medium { color: #F59E0B; }
        .score-low { color: #EF4444; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #666; }
        @media print { 
          body { margin: 20px; }
          .header { page-break-after: avoid; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Montreal Real Estate Investment Report</h1>
        <p>Generated on ${now} for ${user.email}</p>
        <p>Report Type: ${reportType.charAt(0).toUpperCase() + reportType.slice(1)} | Total Zones: ${zones.length}</p>
      </div>

      <div class="summary">
        <h2>Executive Summary</h2>
        <div class="metrics">
          <div class="metric">
            <strong>Average Investment Score:</strong> ${(zones.reduce((sum, z) => sum + (z.investment_score || 0), 0) / zones.length).toFixed(1)}/100
          </div>
          <div class="metric">
            <strong>Average Price/sq ft:</strong> $${(zones.reduce((sum, z) => sum + (z.avg_price_per_sqft || 0), 0) / zones.length).toFixed(0)}
          </div>
          <div class="metric">
            <strong>Average Rent/sq ft:</strong> $${(zones.reduce((sum, z) => sum + (z.avg_rent_per_sqft || 0), 0) / zones.length).toFixed(2)}
          </div>
          <div class="metric">
            <strong>Average Annual Return:</strong> ${(zones.reduce((sum, z) => sum + (z.avg_annual_return || 0), 0) / zones.length).toFixed(1)}%
          </div>
        </div>
      </div>

      <h2>Top Investment Opportunities</h2>
      ${topZones.map((zone, index) => `
        <div class="zone">
          <h3>#${index + 1} ${zone.zone_name} (${zone.zone_id})</h3>
          <div class="metrics">
            <div class="metric">
              <strong>Investment Score:</strong> 
              <span class="${zone.investment_score >= 80 ? 'score-high' : zone.investment_score >= 60 ? 'score-medium' : 'score-low'}">
                ${zone.investment_score || 'N/A'}/100
              </span>
            </div>
            <div class="metric"><strong>Borough:</strong> ${zone.borough}</div>
            <div class="metric"><strong>Price/sq ft:</strong> $${zone.avg_price_per_sqft || 'N/A'}</div>
            <div class="metric"><strong>Rent/sq ft:</strong> $${zone.avg_rent_per_sqft || 'N/A'}</div>
            <div class="metric"><strong>Annual Return:</strong> ${zone.avg_annual_return || 'N/A'}%</div>
            <div class="metric"><strong>Properties:</strong> ${zone.total_properties || 'N/A'}</div>
          </div>
          ${zone.predicted_price ? `
            <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #eee;">
              <h4>AI Predictions</h4>
              <div class="metrics">
                <div class="metric"><strong>Predicted Price:</strong> $${zone.predicted_price}</div>
                <div class="metric"><strong>Predicted Rent:</strong> $${zone.predicted_rent}</div>
                <div class="metric"><strong>Prediction Date:</strong> ${zone.prediction_date ? new Date(zone.prediction_date).toLocaleDateString() : 'N/A'}</div>
              </div>
            </div>
          ` : ''}
        </div>
      `).join('')}

      ${zones.length > 10 ? `
        <h2>Complete Data Table</h2>
        <table>
          <thead>
            <tr>
              <th>Zone</th>
              <th>Borough</th>
              <th>Score</th>
              <th>Price/sq ft</th>
              <th>Rent/sq ft</th>
              <th>Return %</th>
              <th>Properties</th>
            </tr>
          </thead>
          <tbody>
            ${zones.map(zone => `
              <tr>
                <td>${zone.zone_name} (${zone.zone_id})</td>
                <td>${zone.borough}</td>
                <td>${zone.investment_score || 'N/A'}</td>
                <td>$${zone.avg_price_per_sqft || 'N/A'}</td>
                <td>$${zone.avg_rent_per_sqft || 'N/A'}</td>
                <td>${zone.avg_annual_return || 'N/A'}%</td>
                <td>${zone.total_properties || 'N/A'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : ''}

      <div class="footer">
        <p>This report was generated by InvestMTL - Montreal Real Estate Investment Platform</p>
        <p>Data is based on publicly available information and AI predictions. Please conduct your own due diligence before making investment decisions.</p>
      </div>
    </body>
    </html>
  `;
}

export default app;
