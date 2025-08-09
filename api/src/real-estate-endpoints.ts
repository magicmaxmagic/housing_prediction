
import { Env } from './index';

// Nouveaux endpoints pour les données immobilières

// GET /api/evaluation-units - Récupère les unités d'évaluation
export async function getEvaluationUnits(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit') || '100');
  const offset = parseInt(url.searchParams.get('offset') || '0');
  const street = url.searchParams.get('street');
  
  let query = `
    SELECT id, civique_debut, civique_fin, nom_rue, nb_logements, 
           annee_construction, libelle_utilisation, superficie_terrain, 
           superficie_batiment, etages
    FROM evaluation_units 
    WHERE 1=1
  `;
  const params: any[] = [];
  
  if (street) {
    query += ` AND nom_rue LIKE ?`;
    params.push(`%${street}%`);
  }
  
  query += ` ORDER BY nom_rue LIMIT ? OFFSET ?`;
  params.push(limit, offset);
  
  const { results } = await env.DB.prepare(query).bind(...params).all();
  
  return new Response(JSON.stringify({
    data: results,
    pagination: { limit, offset, total: results.length }
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

// GET /api/investment-zones - Récupère les zones d'investissement
export async function getInvestmentZones(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit') || '50');
  const minScore = parseFloat(url.searchParams.get('min_score') || '0');
  
  const query = `
    SELECT street_name, property_count, total_units, avg_construction_year,
           avg_land_surface, avg_building_surface, investment_score,
           density_score, modernity_score, size_score
    FROM investment_zones 
    WHERE investment_score >= ?
    ORDER BY investment_score DESC 
    LIMIT ?
  `;
  
  const { results } = await env.DB.prepare(query).bind(minScore, limit).all();
  
  return new Response(JSON.stringify({
    data: results,
    filters: { min_score: minScore, limit }
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

// GET /api/market-data - Récupère les données de marché
export async function getMarketData(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const dataType = url.searchParams.get('type');
  const region = url.searchParams.get('region');
  
  let query = `
    SELECT data_type, region, period, value, unit, source
    FROM market_data 
    WHERE 1=1
  `;
  const params: any[] = [];
  
  if (dataType) {
    query += ` AND data_type = ?`;
    params.push(dataType);
  }
  
  if (region) {
    query += ` AND region LIKE ?`;
    params.push(`%${region}%`);
  }
  
  query += ` ORDER BY period DESC, data_type`;
  
  const { results } = await env.DB.prepare(query).bind(...params).all();
  
  return new Response(JSON.stringify({
    data: results,
    filters: { type: dataType, region }
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

// GET /api/property-search - Recherche de propriétés
export async function searchProperties(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const street = url.searchParams.get('street');
  const minYear = url.searchParams.get('min_year');
  const maxYear = url.searchParams.get('max_year');
  const minUnits = url.searchParams.get('min_units');
  
  let query = `
    SELECT e.*, i.investment_score
    FROM evaluation_units e
    LEFT JOIN investment_zones i ON e.nom_rue = i.street_name
    WHERE 1=1
  `;
  const params: any[] = [];
  
  if (street) {
    query += ` AND e.nom_rue LIKE ?`;
    params.push(`%${street}%`);
  }
  
  if (minYear) {
    query += ` AND e.annee_construction >= ?`;
    params.push(parseInt(minYear));
  }
  
  if (maxYear) {
    query += ` AND e.annee_construction <= ?`;
    params.push(parseInt(maxYear));
  }
  
  if (minUnits) {
    query += ` AND e.nb_logements >= ?`;
    params.push(parseInt(minUnits));
  }
  
  query += ` ORDER BY i.investment_score DESC, e.annee_construction DESC LIMIT 100`;
  
  const { results } = await env.DB.prepare(query).bind(...params).all();
  
  return new Response(JSON.stringify({
    data: results,
    count: results.length
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
