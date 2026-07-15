export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const { lat, lon, key } = req.body || {};
  if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon)) || !key) {
    return res.status(400).json({ error: 'Latitude, longitude and API key are required.' });
  }
  const params = new URLSearchParams({
    lat: String(lat), lon: String(lon), key: String(key),
    date: 'today', days: '7'
  });
  const url = `https://www.worldtides.info/api/v3?heights&extremes&localtime&${params}`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');
    return res.status(response.ok ? 200 : response.status).json(data);
  } catch (error) {
    return res.status(502).json({ error: 'Unable to reach the tide provider.' });
  }
}
