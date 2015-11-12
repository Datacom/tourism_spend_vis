var resetTabCharts 
var _data = {};
var original_data
var _council_bounds = {};
var _region_bounds = {};
var _auth_dict = {};
var _region_dict = {};
var _title_text = {};
var small_chart_height = 150;

var donut_inner = 43
var donut_outer = 70
var donut_height = 150

var valueAccessor =function(d){return d.value < 1 ? 0 : d.value}

var getkeys;
//----------------------------------------CLEANUP functions----------------------------------------------------------------------------

function cleanup(d) {
  
  d.Spend = +d.Spend*1000000;
  d.YEMar = +d.YEMar
  if (d.Type =='International'){d.Origin == 'Australia' ? d.Type = 'Australian':d.Type = 'Other International'} 
  
  
  return d;
}


//-------------------------------------crossfilter reduce functions---------------------------

// we only use the built in reduceSum(<what we are summing>) here

//-------------------------------------Accessor functions-------------------------------------

// because we are only using default reduce functions, we don't need any accessor functions either 

//-------------------------------------Load data and dictionaries ------------------------------

//Here queue makes sure we have all the data feom all the sources loaded before we try and do anything with it. It also means we don't need to nest D3 file reading loops, which could be annoying. 

queue()
    .defer(d3.csv,  "data/regional_tourism_YE_march.csv")
    .defer(d3.csv,  "dictionaries/NMS_authority_dict.csv")
    .defer(d3.csv,  "dictionaries/Region_dict.csv")
    .defer(d3.csv,  "dictionaries/titles.csv")
    .defer(d3.json, "gis/council_boundaries.singlepart.simp100.WGS84.geojson")
    .defer(d3.json, "gis/region_boundaries_singlepart_simp_p001.geojson")
    .await(showCharts);

function showCharts(err, data, auth_dict, region_dict, title_text, council_bounds, region_bounds) {

//We use dictionary .csv's to store things we might want to map our data to, such as codes to names, names to abbreviations etc.
  
//titles.csv is a special case of this, allowing for the mapping of text for legends and titles on to the same HTML anchors as the charts. This allows clients to update their own legends and titles by editing the csv rather than monkeying around in the .html or paying us to monkey around with the same.    
  
  var councilNames = [];
  
  for (i in title_text){
        entry = title_text[i]
        //trimAll(entry)
        name = entry.id
        _title_text[name]=entry;     
  }
  
  for (i in auth_dict) {
    entry = auth_dict[i]
    trimAll(entry)
    name = entry.Name
    councilNames.push(name);
    _auth_dict[entry.Name]=entry;
  } 

    for (i in region_dict) {
    entry = region_dict[i]
    trimAll(entry)
    name = entry.Map_region
    _region_dict[name]=entry;
  }
  
  for (i in data) {
    data[i] = cleanup(data[i]);
  }
  _data = data;
  _council_bounds = council_bounds;
  _region_bounds = region_bounds;    

//------------Puts legends and titles on the chart divs and the entire page---------------   
  apply_text(_title_text)

//-------------------------------------------FILTERS-----------------------------------------
  ndx = crossfilter(_data); // YAY CROSSFILTER! Unless things get really complicated, this is the only bit where we call crossfilter directly. 

//------------------------------------Count of records---------------------------------------  
  
  
  dc.dataCount(".dc-data-count")
    .dimension(ndx)
    .group(ndx.groupAll());  
  
//-----------------------------------ORDINARY CHARTS --------------------------------------
     
  year = ndx.dimension(function(d) {return d.YEMar});
  year_group = year.group().reduceSum(function(d){return d.Spend});
 
  year_chart = dc.barChart('#year')
    .dimension(year)
    .group(year_group)
    .valueAccessor(valueAccessor)
    .x(d3.scale.linear().domain([2008,2015]))
    //.xUnits() will often look something like ".xUnits(dc.units.fp.precision(<width of bar>))", but here is 1, so we dont need to bother.
    .transitionDuration(200)
    .height(small_chart_height)
    .colors(default_colors)
    .elasticX(false)
    .elasticY(true)
    .centerBar(true)
    
  year_chart.xAxis().ticks(4).tickFormat(d3.format('d'));
  year_chart.yAxis().ticks(4).tickFormat(integer_format)

  product = ndx.dimension(function(d) {return d.Product});
  product_group = product.group().reduceSum(function(d){return d.Spend});
 
  product_chart = dc.rowChart('#product')
    .dimension(product)
    .group(product_group)
//    .data(function(group){console.log(group.all()); 
//                          return _.map(group.all(),function(d){return {key:d.key ,value:d.key.length}})
//                         })
    .valueAccessor(valueAccessor)
    .transitionDuration(200)
    .height(small_chart_height)
    .colors(default_colors)
    .elasticX(true)
    .ordering(function(d) {return d.key})
    .title(function(d){return d.key+': '+title_dollar_format(d.value)})

  product_chart.xAxis().ticks(4).tickFormat(axis_dollar_format)
  product_chart.on('pretransition.dim', dim_zero_rows)
  
  type = ndx.dimension(function(d) {return d.Type});
  type_group = type.group().reduceSum(function(d){return d.Spend});
 
  type_chart = dc.pieChart('#type')
    .dimension(type)
    .group(type_group)
    .valueAccessor(valueAccessor)
    .transitionDuration(200)
    .height(small_chart_height)
    .colors(default_colors) //colors set in utils
    .innerRadius(40)
    .radius(70)
    .title(function(d){return d.key+': '+title_dollar_format(d.value)})
    
  type_chart.on('pretransition.dim', dim_zero_rows)
  
  origin = ndx.dimension(function(d) {return d.Origin});
  origin_group = origin.group().reduceSum(function(d){return d.Spend});
 
  origin_chart = dc.rowChart('#origin')
    .dimension(origin)
    .group(origin_group)
    .valueAccessor(valueAccessor)
    .transitionDuration(200)
    .height(small_chart_height*4)
    .colors(default_colors)
    .elasticX(true)
    .ordering(function(d) {return d.key})
    .title(function(d){return d.key+': '+title_dollar_format(d.value)})
    

  origin_chart.xAxis().ticks(4).tickFormat(axis_dollar_format);
  origin_chart.on('pretransition.dim', dim_zero_rows) 
  
//---------------------------------Map functions

  function zoomed() {
    projection
    .translate(d3.event.translate)
    .scale(d3.event.scale);
    var hidden = projection.scale() == 1600 && JSON.stringify(projection.translate()) == JSON.stringify([220,320]);
    d3.select('#resetPosition').classed('hidden',function(){return hidden})
    district_map.render();
    region_map.render();
    }
  
  zoom = d3.behavior.zoom()
    .translate(projection.translate())
    .scale(projection.scale())
    .scaleExtent([1600, 20000])
    .on("zoom", zoomed);

  
//---------------------------------Map 1. Territorial local authorities 
  
  TLA = ndx.dimension(function(d) { return d['Territorial_Authority']});
  TLA_group = TLA.group().reduceSum(function(d){return d.Spend})
  
  d3.select("#district_map").call(zoom);

  function colourRenderlet(chart) {
    ext = d3.extent(district_map.data(), district_map.valueAccessor());
    ext[0]=0.0001;
    district_map.colorDomain(ext);
    }  
  
district_map = dc.geoChoroplethChart("#district_map")
      .dimension(TLA)
      .group(TLA_group)
      .valueAccessor(valueAccessor)
      .projection(projection)
      .colorAccessor(function(d){return d + 1})
      .colorCalculator(function(d){return !d ? map_zero_colour : colourscale(d)})
      .transitionDuration(200)
      .height(600)
      .overlayGeoJson(_council_bounds.features, 'Territorial_Authority', function(d){return d.properties.TA2013_NAM.replace(' Council', '') })
      .colors(colourscale)
      .title(function(d) {return !d.value ? d.key + ": 0" : d.key + ": " + title_dollar_format(d.value)})
      .on("preRender.color", colourRenderlet)
      .on("preRedraw.color", colourRenderlet)
  
//---------------------------------Map 2 Regions
  
  region = ndx.dimension(function(d) { return d['Region']});
  region_group = region.group().reduceSum(function(d){return d.Spend})
  
  d3.select("#region_map").call(zoom);

  function colourRenderlet(chart) {
    ext = d3.extent(region_map.data(), region_map.valueAccessor());
    ext[0]=0.0001;
    region_map.colorDomain(ext);
  }

  region_map = dc.geoChoroplethChart("#region_map")
      .dimension(region)
      .group(region_group)
      .valueAccessor(valueAccessor)
      .projection(projection)
      .colorAccessor(function(d){return d + 1})
      .colorCalculator(function(d){return !d ? map_zero_colour : colourscale(d)})
      .transitionDuration(200)
      .height(600)
      .overlayGeoJson(_region_bounds.features, 'Region', function(d) {return d.properties.REGC2013_N.replace(' Region', '')})
      .colors(colourscale)
      .title(function(d) {return !d.value ? d.key + ": 0" : d.key + ": " + title_dollar_format(d.value)})
      .on("preRender.color", colourRenderlet)
      .on("preRedraw.color", colourRenderlet)
    
  //--------------------------------paired chart
  
  
  RTO = ndx.dimension(function(d) { return d['RTO']});
  RTO_group = RTO.group().reduceSum(function(d){return d.Spend})
  
  var RTO_charts = generateSplitRowChart(RTO, RTO_group, "#pair_chart1", "#pair_chart2", "#legend_reset", function(d) { return d < 'N'},valueAccessor);
  
  resetRTO = mergeFilters([RTO_charts.chart1, RTO_charts.chart2],"#LegendReset").reset;

  RTO_charts.chart1.xAxis().ticks(4).tickFormat(axis_dollar_format)
  RTO_charts.chart2.xAxis().ticks(4).tickFormat(axis_dollar_format)  

  RTO_charts.chart1.title(function(d){return d.key + ': '+title_dollar_format(d.value)})
  RTO_charts.chart2.title(function(d){return d.key + ': '+title_dollar_format(d.value)})  
   
  width = Math.max(region_map.width(), district_map.width());
  region_map.width(width);
  district_map.width(width);
  RTO_charts.chart1.width(width/2);
  RTO_charts.chart2.width(width/2);

// We use D3.js to put stuff on the page. This array is what D3 needs to know about, and we stick it in the d3 data.
  
   var tabs = [
    {
      label:"RTO List", 
      content:"council_list",
      chart:RTO_charts.chart1,
      resetFunction: function() {resetRTO();dc.redrawAll()},
      type:'rowChart'
    },{
      label:"District Map", 
      content:"district_map",
      chart:district_map, 
      resetFunction:function() {district_map.filterAll();dc.redrawAll()},
      type : 'choropleth'
    },{
      label:"Region Map", 
      content:"region_map",
      chart:region_map,
      resetFunction:function() {region_map.filterAll();dc.redrawAll()},
      type : 'choropleth'
    }
  ];
  make_tabs(tabs)
  
  RTO_charts.chart1.on('filtered.resets', function(selection) {
      d3.selectAll('#tabs').selectAll('.reset').classed('hidden', function(d) { 
        return d.content != 'council_list' || !selection.hasFilter()
      })
      d3.selectAll('#tabs').selectAll('.tab').classed('hasFilter', function(d){return d.chart.hasFilter()})
  })
  
  district_map.on('filtered.resets', function(selection) {
      d3.selectAll('#tabs').selectAll('.reset').classed('hidden', function(d) { 
        return d.content != 'district_map' || !selection.hasFilter()
      })
      d3.selectAll('#tabs').selectAll('.tab').classed('hasFilter', function(d){return d.chart.hasFilter()})
  })
    
  region_map.on('filtered.resets', function(selection) {
      d3.selectAll('#tabs').selectAll('.reset').classed('hidden', function(d) { 
        return d.content != 'region_map' || !selection.hasFilter()
      })
      d3.selectAll('#tabs').selectAll('.tab').classed('hasFilter', function(d){return d.chart.hasFilter()})
  })  
  
  
  d3.selectAll(".inactive_at_start").classed("active", false);
  dc.renderAll()
}
