const DATA_CONTAINER = document.getElementById('data-container');
const DEPARTURES_LETNANY = document.getElementById('departures-letnany');
const DEPARTURES_HAJE = document.getElementById('departures-haje');
const LOADER = document.getElementById('loader');
const REFRESH_BTN = document.getElementById('refresh-btn');

// Zde je API klíč napevno, jelikož se jedná o privátní repozitář
const apiKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NDg0NywiaWF0IjoxNzcxODY2MjA4LCJleHAiOjExNzcxODY2MjA4LCJpc3MiOiJnb2xlbWlvIiwianRpIjoiYTRkNWNmOTItMDQzMC00MjZiLTlhNWMtMTk2YmNiYzlkZThkIn0.lIpLQpWR-AVVgjYTqN1jxuzCTQ8Mx_3Cg3Q03adTSOA';
let fetchInterval = null;

function init() {
    fetchDepartures();

    // Auto-refresh every 20 seconds
    if (fetchInterval) clearInterval(fetchInterval);
    fetchInterval = setInterval(fetchDepartures, 20000);

    // Aktualizace odpočtu každou vteřinu
    setInterval(updateCountdown, 1000);
}

REFRESH_BTN.addEventListener('click', fetchDepartures);

async function fetchDepartures() {
    LOADER.classList.remove('hidden');

    try {
        // Získání odjezdů ze stanice Chodov
        const url = new URL('https://api.golemio.cz/v2/pid/departureboards');
        url.searchParams.append('names', 'Chodov');
        url.searchParams.append('limit', '30'); // Získáme víc odjezdů, pak odfiltrujeme jen linky C

        const response = await fetch(url.toString(), {
            headers: {
                'X-Access-Token': apiKey
            }
        });

        if (!response.ok) {
            throw new Error('Chyba při stahování dat. Status: ' + response.status);
        }

        const data = await response.json();
        renderDepartures(data.departures || []);
    } catch (error) {
        console.error(error);
        DEPARTURES_LETNANY.innerHTML = `<li class="departure-item" style="color:var(--accent);">Chyba připojení k API</li>`;
        DEPARTURES_HAJE.innerHTML = `<li class="departure-item" style="color:var(--accent);">Chyba připojení k API</li>`;
    } finally {
        setTimeout(() => LOADER.classList.add('hidden'), 500);
    }
}

function renderDepartures(departures) {
    // Filtrovat pouze linky nazvané "C"
    const metroCDepartures = departures.filter(dep => dep.route.short_name === 'C');

    // Rozlišit směry - Letňany vs Háje
    const letnany = metroCDepartures.filter(dep => dep.trip.headsign.toLowerCase().includes('let'));
    const haje = metroCDepartures.filter(dep => dep.trip.headsign.toLowerCase().includes('háj'));

    // Vykreslit max. prvních 4 odjezdů pro každý směr
    renderList(DEPARTURES_LETNANY, letnany.slice(0, 4));
    renderList(DEPARTURES_HAJE, haje.slice(0, 4));
}

function renderList(container, trips) {
    container.innerHTML = '';

    if (trips.length === 0) {
        container.innerHTML = '<li class="departure-item" style="justify-content:center;color:var(--text-secondary);">Žádné brzké odjezdy</li>';
        return;
    }

    trips.forEach(trip => {
        // Použít predicted time, pokud chybí pak scheduled
        const timeStr = trip.departure_timestamp.predicted || trip.departure_timestamp.scheduled;
        const departureTime = new Date(timeStr);

        // Zobrazovaný reálný čas odjezdu
        const timeDisplay = departureTime.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });

        // Zpoždění
        let delayDisplay = '';
        if (trip.delay && trip.delay.is_available && trip.delay.minutes > 0) {
            delayDisplay = `<span style="color:var(--accent)"> (+${trip.delay.minutes}m)</span>`;
        }

        const li = document.createElement('li');
        li.className = 'departure-item';
        // Zjemnění animace načtení
        li.style.animation = 'fadeIn 0.5s ease-out';

        li.innerHTML = `
            <div>
                <div style="font-weight: 600; font-size: 1.1rem;">Metro C</div>
                <div class="real-time">🕰️ ${timeDisplay} ${delayDisplay}</div>
            </div>
            <div class="time-left" data-time="${timeStr}">...</div>
        `;
        container.appendChild(li);
    });

    // Okamžitá inicializace odpočtů aby nebyl text "..." dlouho vidět
    updateCountdown();
}

function updateCountdown() {
    const now = new Date();
    document.querySelectorAll('.time-left[data-time]').forEach(el => {
        const departureTime = new Date(el.getAttribute('data-time'));

        let diffSecs = Math.floor((departureTime - now) / 1000);
        if (diffSecs < 0) diffSecs = 0;

        let mins = Math.floor(diffSecs / 60);
        let secs = diffSecs % 60;

        // Naformátovat vteřiny tak, aby vždy měly 2 cifry – zamezí to skákání textu
        const secsStr = secs.toString().padStart(2, '0');

        if (diffSecs === 0) {
            el.innerHTML = '<span class="highlighted">Nyní</span>';
        } else if (mins === 0) {
            el.innerHTML = `<span style="color:var(--accent);">${secsStr} <span>s</span></span>`;
        } else {
            el.innerHTML = `${mins} <span>m</span> ${secsStr} <span>s</span>`;
        }
    });
}

// Start aplikace
document.addEventListener('DOMContentLoaded', init);
