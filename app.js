// Zde je API klíč napevno, jelikož se jedná o privátní repozitář
const apiKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NDg0NywiaWF0IjoxNzcxODY2MjA4LCJleHAiOjExNzcxODY2MjA4LCJpc3MiOiJnb2xlbWlvIiwianRpIjoiYTRkNWNmOTItMDQzMC00MjZiLTlhNWMtMTk2YmNiYzlkZThkIn0.lIpLQpWR-AVVgjYTqN1jxuzCTQ8Mx_3Cg3Q03adTSOA';

const DATA_CONTAINER = document.getElementById('data-container');
const DIRECTIONS_WRAPPER = document.getElementById('directions-wrapper');
const LOADER = document.getElementById('loader');
const REFRESH_BTN = document.getElementById('refresh-btn');
const SEARCH_CONTAINER = document.getElementById('search-container');
const SEARCH_INPUT = document.getElementById('station-search');
const AUTOCOMPLETE_INPUT = document.getElementById('station-search-autocomplete');
const SEARCH_RESULTS = document.getElementById('search-results');
const STATION_TITLE = document.getElementById('station-title');
const THEME_TOGGLE = document.getElementById('theme-toggle');

let fetchInterval = null;
let currentStation = null; // Prázdná výchozí stanice

// Seznam stanic metra seřazený podle skutečného pořadí pro určení směrů
const lineA = ["Nemocnice Motol", "Petřiny", "Nádraží Veleslavín", "Bořislavka", "Dejvická", "Hradčanská", "Malostranská", "Staroměstská", "Můstek", "Muzeum", "Náměstí Míru", "Jiřího z Poděbrad", "Flora", "Želivského", "Strašnická", "Skalka", "Depo Hostivař"];
const lineB = ["Zličín", "Stodůlky", "Luka", "Lužiny", "Hůrka", "Nové Butovice", "Jinonice", "Radlická", "Smíchovské nádraží", "Anděl", "Karlovo náměstí", "Národní třída", "Můstek", "Náměstí Republiky", "Florenc", "Křižíkova", "Invalidovna", "Palmovka", "Českomoravská", "Vysočanská", "Kolbenova", "Hloubětín", "Rajská zahrada", "Černý Most"];
const lineC = ["Letňany", "Prosek", "Střížkov", "Ládví", "Kobylisy", "Nádraží Holešovice", "Vltavská", "Florenc", "Hlavní nádraží", "Muzeum", "I. P. Pavlova", "Vyšehrad", "Pražského povstání", "Pankrác", "Budějovická", "Kačerov", "Roztyly", "Chodov", "Opatov", "Háje"];

// Odstranění duplicit pro našeptávač (přestupní stanice jako Muzeum, Můstek, Florenc)
const uniqueStations = [...new Set([...lineA, ...lineB, ...lineC])].sort((a, b) => a.localeCompare(b, 'cs'));

function init() {
    setupTheme();
    setupSearch();

    // Auto-refresh every 20 seconds only if we selected a station
    if (fetchInterval) clearInterval(fetchInterval);
    fetchInterval = setInterval(() => {
        if (currentStation) fetchDepartures();
    }, 20000);

    // Aktualizace odpočtu každou vteřinu
    setInterval(() => {
        if (currentStation) updateCountdown();
    }, 1000);
}

function setupTheme() {
    const savedTheme = localStorage.getItem('golemio_theme') || 'light';
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-theme');
    }

    THEME_TOGGLE.addEventListener('click', () => {
        document.body.classList.toggle('dark-theme');
        const isDark = document.body.classList.contains('dark-theme');
        localStorage.setItem('golemio_theme', isDark ? 'dark' : 'light');
    });
}

function setupSearch() {
    // Pomocná funkce pro odstranění diakritiky
    const removeDiacritics = (str) => {
        return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    };

    SEARCH_INPUT.addEventListener('input', (e) => {
        const rawVal = e.target.value;
        const val = removeDiacritics(rawVal.toLowerCase());
        SEARCH_RESULTS.innerHTML = '';
        AUTOCOMPLETE_INPUT.value = '';

        if (!val) {
            SEARCH_RESULTS.classList.add('hidden');
            return;
        }

        const matches = uniqueStations.filter(s => removeDiacritics(s.toLowerCase()).includes(val));

        // Hledání první stanice, která ZAČÍNÁ uživatelovým slovem (pro našeptávač uvnitř políčka)
        const startsWithMatch = matches.find(s => removeDiacritics(s.toLowerCase()).startsWith(val));
        if (startsWithMatch) {
            // Zachová se text přesně jak ho napsal uživatel, zbytek se natáhne z opravdového jména
            AUTOCOMPLETE_INPUT.value = rawVal + startsWithMatch.slice(rawVal.length);
        }

        if (matches.length > 0) {
            matches.forEach(match => {
                const li = document.createElement('li');
                li.className = 'search-result-item';
                li.textContent = match;
                li.addEventListener('click', () => {
                    selectStation(match);
                });
                SEARCH_RESULTS.appendChild(li);
            });
            SEARCH_RESULTS.classList.remove('hidden');
        } else {
            SEARCH_RESULTS.classList.add('hidden');
        }
    });

    // Umožnění potvrzení našeptané hodnoty klávesami Enter a Tab
    SEARCH_INPUT.addEventListener('keydown', (e) => {
        if ((e.key === 'Enter' || e.key === 'Tab') && AUTOCOMPLETE_INPUT.value) {
            e.preventDefault(); // Pokud byl stisknut Tab, zabránit přechodu fokusu jinam
            const val = removeDiacritics(AUTOCOMPLETE_INPUT.value.toLowerCase());
            const station = uniqueStations.find(s => removeDiacritics(s.toLowerCase()) === val);
            if (station) {
                selectStation(station);
            }
        }
    });

    const SEARCH_SUBMIT = document.getElementById('search-submit');
    if (SEARCH_SUBMIT) {
        SEARCH_SUBMIT.addEventListener('click', () => {
            if (AUTOCOMPLETE_INPUT.value) {
                const val = removeDiacritics(AUTOCOMPLETE_INPUT.value.toLowerCase());
                const station = uniqueStations.find(s => removeDiacritics(s.toLowerCase()) === val);
                if (station) {
                    selectStation(station);
                }
            }
        });
    }

    // Skrytí když se klikne vedle
    document.addEventListener('click', (e) => {
        if (!SEARCH_INPUT.contains(e.target) && !SEARCH_RESULTS.contains(e.target)) {
            SEARCH_RESULTS.classList.add('hidden');
        }
    });
}

function selectStation(station) {
    currentStation = station;
    SEARCH_INPUT.value = '';
    AUTOCOMPLETE_INPUT.value = '';
    SEARCH_INPUT.placeholder = 'Vyhledat jinou stanici...';
    SEARCH_RESULTS.classList.add('hidden');
    STATION_TITLE.textContent = `Stanice ${station}`;

    // Odhalit interface a animovat vyhledavaci policko
    STATION_TITLE.classList.remove('hidden');
    SEARCH_CONTAINER.classList.remove('initial-state');
    document.getElementById('main-logo').classList.remove('initial-state');
    document.getElementById('hero-image').classList.remove('initial-state');
    DATA_CONTAINER.classList.remove('hidden');

    updateTitleColors(station);

    // Reset columns for layout transition
    DIRECTIONS_WRAPPER.innerHTML = '<div style="width:100%;text-align:center;padding:2rem;"><div class="loader" style="position:static; transform:none; display:inline-block;">Načítám data...</div></div>';

    fetchDepartures();
}

function updateTitleColors(station) {
    let lines = [];
    if (lineA.includes(station)) lines.push('A');
    if (lineB.includes(station)) lines.push('B');
    if (lineC.includes(station)) lines.push('C');

    const uniqueLines = [...new Set(lines)];

    if (uniqueLines.length === 1) {
        STATION_TITLE.style.background = `linear-gradient(to right, #fff, var(--metro-${uniqueLines[0].toLowerCase()}))`;
    } else if (uniqueLines.length > 1) {
        // Přestupní stanice (více barev)
        const c1 = `var(--metro-${uniqueLines[0].toLowerCase()})`;
        const c2 = `var(--metro-${uniqueLines[1].toLowerCase()})`;
        STATION_TITLE.style.background = `linear-gradient(to right, ${c1}, ${c2})`;
    } else {
        STATION_TITLE.style.background = `linear-gradient(to right, #fff, #94a3b8)`;
    }
    STATION_TITLE.style.webkitBackgroundClip = 'text';
    STATION_TITLE.style.color = 'transparent';
}

REFRESH_BTN.addEventListener('click', fetchDepartures);


async function fetchDepartures() {
    LOADER.classList.remove('hidden');

    try {
        const url = new URL('https://api.golemio.cz/v2/pid/departureboards');
        url.searchParams.append('names', currentStation);
        url.searchParams.append('limit', '50'); // Zvýšit limit kvůli jiným módům dopravy (bus/tram)

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
        DIRECTIONS_WRAPPER.innerHTML = `<div style="width:100%;text-align:center;padding:2rem;"><div style="color:var(--metro-c); font-size: 1.2rem;">Chyba připojení k API.</div></div>`;
    } finally {
        setTimeout(() => LOADER.classList.add('hidden'), 500);
    }
}

function getDirectionName(station, headsign, routeShortName) {
    let lineArr = [];
    if (routeShortName === 'A') lineArr = lineA;
    if (routeShortName === 'B') lineArr = lineB;
    if (routeShortName === 'C') lineArr = lineC;

    const currIdx = lineArr.indexOf(station);
    const headIdx = lineArr.indexOf(headsign);

    // Pokud známe obě stanice, určíme absolutní koncovou stanici jako hlavní směr
    if (currIdx !== -1 && headIdx !== -1) {
        if (headIdx > currIdx) return lineArr[lineArr.length - 1]; // np. Háje, Depo Hostivař, Černý Most
        if (headIdx < currIdx) return lineArr[0]; // np. Letňany, Nemocnice Motol, Zličín
    }

    // fallback, pokud se stanici nepodaří přiřadit do pořadí
    return headsign;
}

function renderDepartures(departures) {
    // Filtrovat pouze linky metra nazvané "A", "B", "C"
    // Golemio u metra casto vraci route.short_name jako 'A', 'B', 'C'
    const metroDepartures = departures.filter(dep => ['A', 'B', 'C'].includes(dep.route.short_name));

    // Group by direction (not just headsign) and limit to first 5 departures per group
    const directionsGroups = {};

    metroDepartures.forEach(dep => {
        let headsign = dep.trip.headsign;

        // Zjistíme "hlavní směr" (zabrání tvorbě nového sloupce pro "Kačerov" když už jedeme směr "Háje")
        let directionName = getDirectionName(currentStation, headsign, dep.route.short_name);

        const key = `${dep.route.short_name}-${directionName}`;

        if (!directionsGroups[key]) {
            directionsGroups[key] = {
                line: dep.route.short_name,
                directionName: directionName,
                trips: []
            };
        }

        // Cílová stanice může být kratší, tak si ji uchováme pro detailní info u samotného vlaku
        dep._renderedHeadsign = headsign;

        directionsGroups[key].trips.push(dep);
    });

    DIRECTIONS_WRAPPER.innerHTML = '';
    const keys = Object.keys(directionsGroups);

    if (keys.length === 0) {
        DIRECTIONS_WRAPPER.innerHTML = '<div style="width:100%;text-align:center;color:var(--text-secondary);padding:2rem;">Žádné brzké odjezdy metra</div>';
        return;
    }

    // Vygenerovat pro každý směr jeden sloupec
    keys.forEach(key => {
        const group = directionsGroups[key];
        const lineStr = group.line.toLowerCase();
        const colorVar = `var(--metro-${lineStr})`;

        const col = document.createElement('div');
        col.className = 'direction-column';

        col.innerHTML = `
            <div class="direction-header" style="border-bottom: 2px solid ${colorVar};">
                Směr ${group.directionName} <span style="color:${colorVar}; font-weight:bold;">(M- ${group.line})</span>
            </div>
            <ul class="departure-list"></ul>
        `;

        const list = col.querySelector('.departure-list');
        renderList(list, group.trips.slice(0, 5), colorVar, group.line); // max 5 per column

        DIRECTIONS_WRAPPER.appendChild(col);
    });

    // Okamžitá inicializace odpočtů
    updateCountdown();
}

function renderList(container, trips, colorVar, lineShort) {
    trips.forEach(trip => {
        const timeStr = trip.departure_timestamp.predicted || trip.departure_timestamp.scheduled;
        const departureTime = new Date(timeStr);
        const timeDisplay = departureTime.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });

        // Zpoždění
        let delayDisplay = '';
        if (trip.delay && trip.delay.is_available && trip.delay.minutes > 0) {
            delayDisplay = `<span style="color:${colorVar}"> (+${trip.delay.minutes}m)</span>`;
        }

        const li = document.createElement('li');
        li.className = 'departure-item';
        li.style.animation = 'fadeIn 0.5s ease-out';

        // Pokud má vlak jinou konečnou než hlavní směr (např. Kačerov místo Háje), ukážeme to v detailu
        let detailHeadsign = '';
        if (trip._renderedHeadsign !== getDirectionName(currentStation, trip._renderedHeadsign, lineShort)) {
            detailHeadsign = `<span style="font-size:0.85em; color:var(--text-secondary); margin-left:8px;">(jede jen na ${trip._renderedHeadsign})</span>`;
        }

        li.innerHTML = `
            <div>
                <div style="font-weight: 600; font-size: 1.1rem; color: ${colorVar}">Metro ${lineShort} ${detailHeadsign}</div>
                <div class="real-time">🕰️ ${timeDisplay} ${delayDisplay}</div>
            </div>
            <div class="time-left" data-time="${timeStr}" data-color="${colorVar}">...</div>
        `;
        container.appendChild(li);
    });
}

function updateCountdown() {
    const now = new Date();
    document.querySelectorAll('.time-left[data-time]').forEach(el => {
        const departureTime = new Date(el.getAttribute('data-time'));
        const colorVar = el.getAttribute('data-color') || 'var(--metro-c)';

        let diffSecs = Math.floor((departureTime - now) / 1000);
        if (diffSecs < 0) diffSecs = 0;

        let mins = Math.floor(diffSecs / 60);
        let secs = diffSecs % 60;

        const secsStr = secs.toString().padStart(2, '0');

        if (diffSecs === 0) {
            el.innerHTML = `<span class="highlighted" style="color:${colorVar}">Nyní</span>`;
        } else if (mins === 0) {
            el.innerHTML = `<span style="color:${colorVar}">${secsStr}</span> <span class="unit">s</span>`;
        } else {
            el.innerHTML = `${mins} <span class="unit">m</span> ${secsStr} <span class="unit">s</span>`;
        }
    });
}

// Start aplikace
document.addEventListener('DOMContentLoaded', init);
