var margin = [10, 200, 50, 200]; // [top, right, bottom, left]
var depthGap = 180;              // horizontal px between tree depth levels

// --- Responsive horizontal layout ---------------------------------------
// The tree is drawn left-to-right with a fixed gap per depth level and wide
// side margins. Those fixed values run off narrow screens (e.g. phones), so
// scale them to the viewport width. Called on load and on every resize.
function computeLayout() {
  var w = window.innerWidth;
  margin[3] = Math.max(72, Math.min(200, w * 0.16)); // left: room for root label
  margin[1] = Math.max(16, Math.min(200, w * 0.05)); // right: small padding
  depthGap  = Math.max(54, Math.min(180, w * 0.20)); // gap between depth levels
}
computeLayout();

function getWidth() {
  return window.innerWidth - margin[1] - margin[3];
}

function getHeight() {
  return window.innerHeight - margin[0] - margin[2];
}

var width = getWidth(),
    height = getHeight(),
    i = 0,
    duration = 1250,
    root;


var tree = d3.layout.tree()
    .size([height, width]);

var diagonal = d3.svg.diagonal()
    .projection(function(d) { return [d.y, d.x]; });

var svg = d3.select("#body").append("svg:svg")
    .attr("width", width + margin[1] + margin[3])
    .attr("height", height + margin[0] + margin[2]);

// Pan layer: on narrow screens the tree's labels can extend past the
// viewport, so let the user drag the whole tree to reach them.
var panLayer = svg.append("svg:g").attr("class", "pan-layer");

var vis = panLayer.append("svg:g")
    .attr("transform", "translate(" + margin[3] + "," + margin[0] + ")");

// Pan-only behavior (no zoom/scale). Toggled on in resize() for small
// screens; disabled on desktop where the whole tree already fits.
var panEnabled = false;
var zoom = d3.behavior.zoom()
    .scaleExtent([1, 1])
    .on("zoom", function () {
      panLayer.attr("transform", "translate(" + d3.event.translate + ")");
    });

function setPan(enable) {
  if (enable === panEnabled) return;
  panEnabled = enable;
  if (enable) {
    svg.call(zoom);
  } else {
    // d3 v3 can't remove listeners by namespace alone, so null each one.
    zoom.translate([0, 0]);
    svg.on("mousedown.zoom", null)
       .on("mousemove.zoom", null)
       .on("dblclick.zoom", null)
       .on("touchstart.zoom", null)
       .on("touchmove.zoom", null)
       .on("touchend.zoom", null)
       .on("mousewheel.zoom", null)
       .on("MozMousePixelScroll.zoom", null)
       .on("wheel.zoom", null)
       .on("DOMMouseScroll.zoom", null);
    panLayer.attr("transform", null); // reset to identity on desktop
  }
}

d3.json("arf.json?v=2", function(json) {
  root = json;
  root.x0 = height / 2;
  root.y0 = 0;

  function collapse(d) {
    if (d.children) {
      d._children = d.children;
      d._children.forEach(collapse);
      d.children = null;
    }
  }

/*  function toggleAll(d) {
    if (d.children) {
      d.children.forEach(toggleAll);
      toggle(d);
    }
  } */
  root.children.forEach(collapse);
  update(root);
});

function update(source) {
  // var duration = d3.event && d3.event.altKey ? 5000 : 500;

  // Compute the new tree layout.
  var nodes = tree.nodes(root).reverse();
  
  // Normalize for fixed-depth (responsive gap between levels).
  nodes.forEach(function(d) { d.y = d.depth * depthGap; });

  // Update the nodes…
  var node = vis.selectAll("g.node")
      .data(nodes, function(d) { return d.id || (d.id = ++i); });

  // Enter any new nodes at the parent's previous position.
  var nodeEnter = node.enter().append("svg:g")
      .attr("class", "node")
      .attr("transform", function(d) { return "translate(" + source.y0 + "," + source.x0 + ")"; })
      .on("click", function(d) { toggle(d); update(d); });

 nodeEnter.append("svg:circle")
    .attr("r", 1e-6)
    .style("fill", function(d) { return d._children ? "#dddddd" : "#616161"; })
    .on("click", function(d) {
      // Leaf node with URL → navigate. Internal pages stay in the same
      // tab; external links (type "url") open in a new tab.
      if (d.url && !d.children && !d._children) {
        if (d.type === "internal") window.location.href = d.url;
        else window.open(d.url, "_blank", "noopener");
        d3.event.stopPropagation();
      }
    });


  nodeEnter.append('a')
      .attr("target", function(d) { return d.type === "internal" ? "_self" : "_blank"; })
      .attr("rel", function(d) { return d.type === "internal" ? null : "noopener noreferrer"; })
      .attr('xlink:href', function(d) { return d.url; })
      .append("svg:text")
      .attr("x", function(d) { return d.children || d._children ? -10 : 10; })
      .attr("dy", ".35em")
      .attr("text-anchor", function(d) { return d.children || d._children ? "end" : "start"; })
      .text(function(d) { return d.name; })
      .style("fill: rgb(0, 0, 0)", function(d) { return d.free ? 'black' : '#999'; })
      .style("fill-opacity", 1e-6);

  nodeEnter.append("svg:title")
    .text(function(d) {
      return d.description;
    });

  // Transition nodes to their new position.
  var nodeUpdate = node.transition()
      .duration(duration)
      .attr("transform", function(d) { return "translate(" + d.y + "," + d.x + ")"; });

  nodeUpdate.select("circle")
      .attr("r", 6)
      .style("fill", function(d) { return d._children ? "#dddddd" : "#fff" });

  nodeUpdate.select("text")
      .style("fill-opacity", 1);

  // Transition exiting nodes to the parent's new position.
  var nodeExit = node.exit().transition()
      .duration(duration)
      .attr("transform", function(d) { return "translate(" + source.y + "," + source.x + ")"; })
      .remove();

  nodeExit.select("circle")
      .attr("r", 1e-6);

  nodeExit.select("text")
      .style("fill-opacity", 1e-6);

  // Update the links…
  var link = vis.selectAll("path.link")
      .data(tree.links(nodes), function(d) { return d.target.id; });

  // Enter any new links at the parent's previous position.
  link.enter().insert("svg:path", "g")
      .attr("class", "link")
      .attr("d", function(d) {
        var o = {x: source.x0, y: source.y0};
        return diagonal({source: o, target: o});
      })
    .transition()
      .duration(duration)
      .attr("d", diagonal);

  // Transition links to their new position.
  link.transition()
      .duration(duration)
      .attr("d", diagonal);

  // Transition exiting nodes to the parent's new position.
  link.exit().transition()
      .duration(duration)
      .attr("d", function(d) {
        var o = {x: source.x, y: source.y};
        return diagonal({source: o, target: o});
      })
      .remove();

  // Stash the old positions for transition.
  nodes.forEach(function(d) {
    d.x0 = d.x;
    d.y0 = d.y;
  });
}

// Toggle children.
function toggle(d) {
  if (d.children) {
    d._children = d.children;
    d.children = null;
  } else {
    d.children = d._children;
    d._children = null;
  }
}
//Togle Dark Mode
function goDark() {
  var element = document.body;
  element.classList.toggle("dark-Mode");
} 

function resize() {
  computeLayout();
  width = getWidth();
  height = getHeight();

  // Resize SVG
  svg
    .attr("width", width + margin[1] + margin[3])
    .attr("height", height + margin[0] + margin[2]);

  // Reposition the root group for the current (responsive) side margin.
  vis.attr("transform", "translate(" + margin[3] + "," + margin[0] + ")");

  // On narrow screens, enable dragging the tree so off-screen labels
  // remain reachable; on desktop the tree fits, so keep it fixed.
  setPan(window.innerWidth < 700);

  // Update tree layout size
  tree.size([height, width]);

  // Re-center root for smooth animation
  if (root) {
    root.x0 = height / 2;
    root.y0 = 0;
    update(root);
  }
}

// Run once on load
resize();

// Run on window resize
window.addEventListener("resize", resize);
