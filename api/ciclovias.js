const ARCGIS_URL =
  'https://serviciosgis.catastrobogota.gov.co/arcgis/rest/services/Mapa_Referencia/Mapa_Referencia/MapServer/18/query';

export default async function handler(req, res) {
  try {
    const features = [];
    let offset = 0;

    while (true) {
      const url =
        `${ARCGIS_URL}?where=1%3D1&outFields=CICTSUPERF&f=geojson` +
        `&resultRecordCount=1000&resultOffset=${offset}`;

      const upstream = await fetch(url);
      if (!upstream.ok) throw new Error('upstream ' + upstream.status);

      const data = await upstream.json();
      if (!data.features?.length) break;
      features.push(...data.features);
      if (!data.exceededTransferLimit) break;
      offset += 1000;
      if (offset > 20000) break;
    }

    // Cache en CDN de Vercel 24 h, stale-while-revalidate 1 h
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=3600');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).json({ type: 'FeatureCollection', features });

  } catch (err) {
    console.error('[ciclovias] error:', err.message);
    res.status(502).json({ error: 'No se pudo obtener el GeoJSON del IDU' });
  }
}
