const WIDTH = 1000, HEIGHT = 540;
const GDP_PATH = "../data/lab9_gdp_2025_top50.csv";
const GEO_PATH = "data/world.geojson";
const money = value => `$${d3.format(',.1f')(value)} billion`;
let pinned = '', hovered = '', statsById, color, values, countryPaths, circles, labels, mapSvg, zoom;
const tooltip = document.querySelector('#tooltip');
const details = document.querySelector('#details');
const idOf = f => String(f.properties.iso3 || f.properties['ISO3166-1-Alpha-3'] || f.properties.ISO_A3 || f.id || '').toUpperCase();
function activeId() { return hovered || pinned; }
function highlight() {
  const id = activeId();
  countryPaths.classed('active', f => idOf(f) === id).classed('muted', f => Boolean(id) && idOf(f) !== id);
  circles.classed('active', d => d.iso3 === id).classed('muted', d => Boolean(id) && d.iso3 !== id);
  labels.classed('muted', d => Boolean(id) && d.iso3 !== id);
  const row = statsById.get(id);
  details.textContent = row ? `${row.country} · ${money(row.value)} · Rank ${row.rank} among included economies` : id ? `${id} · No GDP in the provided dataset` : 'Hover over a country, or click to keep it selected.';
}
function interact(selection, id, name) {
  selection.attr('tabindex', 0).attr('role', 'button').attr('aria-label', d => `${name(d)}: ${statsById.has(id(d)) ? money(statsById.get(id(d)).value) : 'No data'}`)
    .on('pointerenter', (event, d) => { hovered = id(d); highlight(); showTip(event, d); })
    .on('pointermove', showTip)
    .on('pointerleave', () => { hovered = ''; tooltip.hidden = true; highlight(); })
    .on('focus', (_, d) => { hovered = id(d); highlight(); })
    .on('blur', () => { hovered = ''; highlight(); })
    .on('click', (_, d) => pin(id(d)))
    .on('keydown', (event, d) => { if (event.key === 'Enter' || event.key === ' ') {event.preventDefault(); pin(id(d));} });
  function showTip(event, d) {
    const row = statsById.get(id(d));
    tooltip.textContent = row ? `${row.country} — ${money(row.value)} · Rank ${row.rank}` : `${name(d)} — No data in provided top 50`;
    tooltip.hidden = false;
    tooltip.style.left = `${Math.max(8, Math.min(event.clientX + 14, window.innerWidth - tooltip.offsetWidth - 8))}px`;
    tooltip.style.top = `${Math.max(8, Math.min(event.clientY + 14, window.innerHeight - tooltip.offsetHeight - 8))}px`;
  }
}
function pin(id) { pinned = pinned === id ? '' : id; document.querySelector('#country').value = statsById.has(pinned) ? pinned : ''; highlight(); }
function updateColor() {
  const logarithmic = document.querySelector('#scale').value === 'log';
  const extent = d3.extent(values, d => d.value);
  color = (logarithmic ? d3.scaleSequentialLog(d3.interpolateViridis) : d3.scaleSequential(d3.interpolateViridis)).domain(extent);
  countryPaths.attr('fill', f => statsById.has(idOf(f)) ? color(statsById.get(idOf(f)).value) : '#dfe3e2');
  circles.attr('fill', d => color(d.value));
  const legend = d3.select('#legend'); legend.selectAll('*').remove();
  const gradient = legend.append('defs').append('linearGradient').attr('id', 'gdp-gradient');
  const scale = (logarithmic ? d3.scaleLog() : d3.scaleLinear()).domain(extent).range([35, 620]);
  for (let i = 0; i <= 100; i++) gradient.append('stop').attr('offset', `${i}%`).attr('stop-color', color(scale.invert(35 + i / 100 * 585)));
  legend.append('rect').attr('x',35).attr('y',8).attr('width',585).attr('height',14).attr('fill','url(#gdp-gradient)');
  const ticks = logarithmic ? [extent[0], ...[100, 500, 1000, 5000, 10000].filter(v => v > extent[0] * 1.3 && v < extent[1] / 1.3), extent[1]] : scale.ticks(5);
  legend.append('g').attr('transform','translate(0,22)').call(d3.axisBottom(scale).tickValues(ticks).tickFormat(d3.format(',.0f')));
  legend.append('text').attr('x',35).attr('y',68).attr('font-size',12).text(`GDP, billion USD · ${logarithmic ? 'logarithmic' : 'linear'} color scale`);
  legend.append('rect').attr('x',730).attr('y',8).attr('width',16).attr('height',16).attr('fill','#dfe3e2');
  legend.append('text').attr('x',755).attr('y',21).attr('font-size',12).text('No provided GDP');
}
async function main() {
  const [geo, raw] = await Promise.all([d3.json(GEO_PATH), d3.csv(GDP_PATH)]);
  values = raw.map(d => ({iso3:(d.iso3 || '').trim().toUpperCase(), country:d.country, value:Number(d.gdp_2025_billion_usd), rank:Number(d.rank)}));
  if (values.length !== 50 || values.some(d => !/^[A-Z]{3}$/.test(d.iso3) || !d.country || !(d.value > 0) || !Number.isInteger(d.rank)) || new Set(values.map(d => d.iso3)).size !== 50) throw Error('CSV must contain 50 unique ISO-3 economies with positive GDP and integer ranks. Run prepare_data.py for validation.');
  statsById = new Map(values.map(d => [d.iso3,d]));
  const features = geo.features.filter(f => idOf(f) !== 'ATA');
  const featureById = new Map(features.map(f => [idOf(f),f]));
  const unmatched = values.filter(d => !featureById.has(d.iso3));
  if (unmatched.length) throw Error(`GDP countries missing geographic boundaries: ${unmatched.map(d=>d.iso3).join(', ')}. Fix ISO-3 identifiers before publishing.`);
  const projection = d3.geoEqualEarth().fitExtent([[20,20],[980,520]], {type:'FeatureCollection',features});
  const path = d3.geoPath(projection);
  mapSvg = d3.select('#choropleth');
  const group = mapSvg.append('g');
  countryPaths = group.selectAll('path').data(features).join('path').attr('class','country').attr('d',path);
  zoom = d3.zoom().scaleExtent([1,8]).on('zoom', event => group.attr('transform',event.transform));
  mapSvg.call(zoom);
  // Radius is sqrt(GDP * constant / pi), so area is exactly proportional to raw GDP.
  const areaConstant = 135000 / d3.sum(values,d=>d.value);
  const overrides = {USA:[-100,38], CAN:[-105,57], RUS:[95,60], FRA:[2,47], NOR:[9,62]};
  const nodes = values.map(d => {
    const position = projection(overrides[d.iso3] || d3.geoCentroid(featureById.get(d.iso3)));
    return {...d, ax:position[0], ay:position[1]+40, x:position[0], y:position[1]+40, r:Math.sqrt(d.value*areaConstant/Math.PI)};
  });
  const simulation = d3.forceSimulation(nodes).randomSource(d3.randomLcg(0.42)).force('x',d3.forceX(d=>d.ax).strength(.13)).force('y',d3.forceY(d=>d.ay).strength(.13)).force('collision',d3.forceCollide(d=>d.r+2).strength(1).iterations(6)).stop();
  for(let i=0;i<500;i++) simulation.tick();
  // Fit the entire circle layout uniformly; this preserves all area ratios.
  const cart = d3.select('#cartogram');
  const bounds = [d3.min(nodes,d=>d.x-d.r),d3.min(nodes,d=>d.y-d.r),d3.max(nodes,d=>d.x+d.r),d3.max(nodes,d=>d.y+d.r)];
  const fit = Math.min(940/(bounds[2]-bounds[0]),570/(bounds[3]-bounds[1]));
  const cartGroup = cart.append('g').attr('transform',`translate(${30-bounds[0]*fit},${30-bounds[1]*fit}) scale(${fit})`);
  circles = cartGroup.selectAll('circle').data(nodes).join('circle').attr('class','bubble').attr('cx',d=>d.x).attr('cy',d=>d.y).attr('r',d=>d.r);
  labels = cartGroup.selectAll('text').data(nodes.filter(d=>d.r>14)).join('text').attr('class','bubble-label').attr('x',d=>d.x).attr('y',d=>d.y).attr('dy','.35em').attr('text-anchor','middle').text(d=>d.iso3);
  const areaLegend = d3.select('#area-legend');
  [1000,5000,10000].forEach((v,i)=> {const r=Math.sqrt(v*areaConstant/Math.PI)*fit;const x=100+i*260;areaLegend.append('circle').attr('cx',x).attr('cy',53).attr('r',r).attr('fill','none').attr('stroke','#607b76');areaLegend.append('text').attr('x',x+65).attr('y',57).attr('font-size',12).text(`$${d3.format(',')(v)} bn`);});
  const selector = d3.select('#country'); values.slice().sort((a,b)=>d3.ascending(a.country,b.country)).forEach(d=>selector.append('option').attr('value',d.iso3).text(d.country));
  selector.on('change', event=>{pinned=event.target.value;hovered='';highlight();});
  interact(countryPaths,idOf,f=>f.properties.name || f.properties.ADMIN || idOf(f));
  interact(circles,d=>d.iso3,d=>d.country);
  document.querySelector('#scale').addEventListener('change',updateColor);
  document.querySelector('#reset-map').addEventListener('click',()=>mapSvg.call(zoom.transform,d3.zoomIdentity));
  document.querySelector('#reset').addEventListener('click',()=>{pinned='';hovered='';selector.property('value','');tooltip.hidden=true;highlight();mapSvg.call(zoom.transform,d3.zoomIdentity);});
  updateColor(); highlight();
  document.querySelector('#status').textContent = `Join verified: ${values.length}/50 economies matched · Total GDP of included economies: ${money(d3.sum(values,d=>d.value))}.`;
}
main().catch(error=>{document.querySelector('#status').textContent=`Unable to load assignment data: ${error.message} Place the instructor CSV and world.geojson in lab9/data/. Serve the page over HTTP.`;console.error(error);});
