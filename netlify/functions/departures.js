const GOLEMIO_API_KEY = process.env.GOLEMIO_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NDg0NywiaWF0IjoxNzcxODY2MjA4LCJleHAiOjExNzcxODY2MjA4LCJpc3MiOiJnb2xlbWlvIiwianRpIjoiYTRkNWNmOTItMDQzMC00MjZiLTlhNWMtMTk2YmNiYzlkZThkIn0.lIpLQpWR-AVVgjYTqN1jxuzCTQ8Mx_3Cg3Q03adTSOA';

// Jednoduchá in-memory cache pro zahřívané funkce
let cache = {};

exports.handler = async function(event, context) {
    const station = event.queryStringParameters.names;
    if (!station) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Missing station name' }) };
    }

    const limit = event.queryStringParameters.limit || '50';
    const minutesBefore = event.queryStringParameters.minutesBefore || '1';

    const url = new URL('https://api.golemio.cz/v2/pid/departureboards');
    url.searchParams.append('names', station);
    url.searchParams.append('limit', limit);
    url.searchParams.append('minutesBefore', minutesBefore);
    
    const urlString = url.toString();
    const now = Date.now();

    // Pokud už máme platnou cache starší max 5 sekund (nebo 10 sekund), vrátíme ji.
    // Tím snížíme počet dotazů na Golemio API při mnoha uživatelích najednou.
    if (cache[urlString] && (now - cache[urlString].timestamp < 10000)) {
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'public, max-age=10, s-maxage=10' // CDN / prohlížeč cache
            },
            body: JSON.stringify(cache[urlString].data)
        };
    }

    try {
        const response = await fetch(urlString, {
            headers: {
                'X-Access-Token': GOLEMIO_API_KEY
            }
        });

        if (!response.ok) {
            return {
                statusCode: response.status,
                body: JSON.stringify({ error: `Chyba API Golemio: ${response.status}` })
            };
        }

        const data = await response.json();
        
        // Uložení do in-memory cache
        cache[urlString] = { data, timestamp: now };

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'public, max-age=10, s-maxage=10'
            },
            body: JSON.stringify(data)
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};
