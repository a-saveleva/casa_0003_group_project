
// ✅ 完整封装 section2_init.js 为 initSecondMap()
// 🔄 所有原始逻辑已嵌入函数体，main.js 中调用 initSecondMap() 即可启动

export function  initSecondMap() {
  let scrollStage = 0;
  let scrollDistance = 0;
  let lastScrollTime = 0
  let introCleared = false;  // ✅ 加上这句
const scrollThreshold = 900; 
const cardLiftThreshold = 600;

// 每张卡片完全上浮所需的总距离（例如 8次×20）
const perScrollStep = 200;    // 每次滚轮滑动卡片移动距离）

  const maxShiftPercent = 90;  // 总共上浮百分比
  const maxLift = 600;

  const maxStage =9;
  const durations = ['30min','60min','90min','120min'];
  const cityCoords = {
    London: [-0.02, 51.30], Manchester: [-2.24, 53.48],
    Birmingham: [-1.90, 52.48], Bristol: [-2.59, 51.45],
    Sheffield: [-1.47, 53.38], Leeds: [-1.5491, 53.8008],
    Glasgow: [-4.25, 55.86], Edinburgh: [-3.19, 55.95]
  };

  let sortedFeatures = [];
  let recs;
  let scrollCount = 0;
  
  
  
  // ✅ 放在你的 main.js 或 <script> 上部
const cardContainer = document.getElementById('card-container');
const textData = [
  `🚆 Britain's rail system is among the densest in Europe.\nTrains link cities with remarkable speed and frequency—laying the foundation for exploring green spaces near and far.`,
  `⏱️ 30-minute Accessibility
  Starting from major central train stations in cities like London, Manchester, Birmingham, and Edinburgh, we examine areas reachable within 30 minutes by rail. Despite London's extensive urban footprint and network, its 30-minute isochrone covers a smaller area than other cities.`,
  `⏱️ 60-minute Expansion
  The one-hour rail isochrone begins to reveal London's advantage as a national railway hub, with extensive connectivity to surrounding towns and a high density of accessible stations in all directions.`,
  `⏱️ 90-minute Reach
  Within 90 minutes, most of these major cities become interconnected by rail, enabling easy travel not only between urban centres but also to the natural and rural landscapes along the way.`,
  `⏱️ 120-minute Full Ring
  At the 120-minute mark, accessibility extends well beyond inland landscapes—coastal areas and beaches also come within reach, inviting exploration of both forests and seaside escapes.`,
  `The green dots on the map represent accessible green assets reachable within two hours, most of which can be directly accessed via a combination of train and walking. Hovering over any city reveals its corresponding isochrone rings, highlighting the extent of its green space reachability.`,
  `The bubble chart shows the number and total area of green assets accessible from each city. London leads in both metrics, highlighting its exceptional green connectivity. Hover over any bubble to explore the types of green spaces available at each time interval.` ,
  `While Edinburgh itself has relatively limited rail-accessible green resources, it enjoys strong connectivity with Glasgow, allowing for extensive shared access to green assets across the two cities.`,
  `This map reveals the limitless potential of experiencing nature by train — a journey that is green, effortless, and just one ticket away from a world of rich and diverse landscapes.`
 ];



const activityData = [
      { rank: 1, activity: "Hiking" },
      { rank: 2, activity: "Cycling" },
      { rank: 3, activity: "Birdwatching" },
      { rank: 4, activity: "Camping" },
      { rank: 5, activity: "Stargazing" },
      { rank: 6, activity: "Wildlife\nphotography" },
      { rank: 7, activity: "Berry picking" },
      { rank: 8, activity: "Swimming " },
      { rank: 9, activity: "Trail\nrunning " },
      { rank: 10, activity: "Leaf peeping" }
    ];

  const tooltip = d3.select('#tooltip');

  // 示例地图初始化（粘贴完整内容替换此处）
  // 1. 初始化 Mapbox
  mapboxgl.accessToken = 'pk.eyJ1IjoieWFsbGxlMDUwMyIsImEiOiJjbTZpMnpoYWkwNGNlMnFzaGg2OTZ6dWcwIn0.9crGea8A_PZB83mBnq1r2w';
  const secondMap = new mapboxgl.Map({
    container:'secondMap',
    style:'mapbox://styles/yallle0503/cmahdvqg000xm01qy0m3v0y55',
    center:[-1.5,53.1],
    zoom:6.1,
    pitch: 35,     // ⬅️ 倾斜角，0是垂直俯视，最大60
    bearing: -30,  // ⬅️ 顺时针旋转角度，负值表示向左偏转
    scrollZoom: false  // ⛔ 禁止默认滚轮缩放
  });

  //
    
function restoreAllLayers() {
  secondMap.getCanvas().style.cursor = '';
  durations.forEach(dur => {
    secondMap.setPaintProperty(`iso-fill-${dur}`, 'fill-opacity', 0.2);
    secondMap.setPaintProperty(`iso-line-${dur}`, 'line-opacity', 0.8);
  });
}



function handleWheel(e) {
  if (scrollStage < maxStage) e.preventDefault();

  const now = Date.now();
  if (now - lastScrollTime < 100) return;
  lastScrollTime = now;

if (!introCleared) {
  introCleared = true;
  const cover = document.getElementById('intro-cover');
  cover.style.opacity = '0';
  document.getElementById('activity-bubbles').style.opacity = '0';
  setTimeout(() => {
    cover.style.display = 'none';
    // ✅ 只隐藏，不删除
    // document.getElementById('activity-bubbles').remove();  <-- ❌ 注释掉这一行
    document.getElementById('activity-bubbles').style.display = 'none';  // ✅ 改为隐藏
  }, 1000);
  return;
}


  if (scrollStage >= maxStage) return;

  scrollDistance += e.deltaY * 2;

  const allCards = document.querySelectorAll('.card');
  allCards.forEach(card => {
    const cardStage = Number(card.getAttribute('data-stage'));
    const shift = (scrollStage - cardStage) * scrollThreshold + scrollDistance;
    card.style.transform = `translate(calc(-50% + 400px), -${shift}px)`;
  });

  // ✅ 检查上一张是否彻底出画（rect.bottom < 0）
  const prevCard = document.querySelector(`.card[data-stage="${scrollStage - 1}"]`);
  const prevCardGone = !prevCard || prevCard.getBoundingClientRect().bottom < 0;

  // ✅ 仅当上一张彻底出画 + 滚动量超限，才加载新卡片
  if (scrollDistance > scrollThreshold && scrollStage < maxStage && prevCardGone) {
    scrollStage++;
    scrollDistance = 0;
    showNewCard(scrollStage);
    updateMapAndCard(scrollStage);
  }

  // ✅ 清理离开视野的卡片（如果仍残留）
  allCards.forEach(card => {
    const rect = card.getBoundingClientRect();
    if (rect.bottom < -100) {
      card.remove();
    }
  });

  if (scrollStage >= maxStage) {
    window.removeEventListener('wheel', handleWheel);
    const nextSection = document.querySelector('#section3');
    if (nextSection) {
      setTimeout(() => {
        nextSection.scrollIntoView({ behavior: 'smooth' });
      }, 500);
    }
  }
}




  const colorMap = {
  30: '#bc3c66',
  60: '#EA7A57',
  90: '#EEAA44',
  120: '#9DB94A'
  };
    secondMap.on('load', async () => {
   
//// ✅ 加载 sortedFeatures 和构建 recs（从 json 文件加载）
const isoRes = await fetch('./all_isochrone1.json');
sortedFeatures = await isoRes.json();

// ✅ 构造 recs（用于气泡图）
recs = sortedFeatures.map(f => {
  const [city, dRaw] = f.properties.id.split('_');
  const dur = +dRaw.replace('min', '');
  return {
    props: f.properties,
    city: city,
    x: f.properties.total_points + (Math.random() - 0.5) * 4,
    y: Math.round(f.properties.total_green_area_buffered / 1e6),
    color: colorMap[dur]
  };
});
drawBubbleChart(recs);  // 加在 recs 构造完成后
// ✅ 加载 London 的 radial chart（避免初始为空）
const defaultFeature = recs.find(d => d.city === 'London');
if (defaultFeature) drawRadialChart(defaultFeature.props);

  // ✅ 再生成城市按钮（必须在 recs 初始化后）
const ctrl = d3.select('#controls-panel');
const cities = Array.from(new Set(recs.map(r => r.city)));
cities.forEach(c => {
  ctrl.append('button')
    .text(c)
    .attr('class', 'city-btn')
    .on('click', function () {
      d3.selectAll('.city-btn').classed('active', false);
      d3.select(this).classed('active', true);
      filterCity(c);
      if (cityCoords[c]) {
        secondMap.flyTo({
          center: cityCoords[c],
          zoom: 8.5,
          speed: 0.8,
          curve: 1.5,
          essential: true
        });
      }
    });
});

// ✅ 添加 Show All 按钮
ctrl.append('button')
  .text('Show All')
  .attr('class', 'city-btn')
  .on('click', function () {
    d3.selectAll('.city-btn').classed('active', false);
    d3.select(this).classed('active', true);
    filterCity(null);
  });


    // 2. 加载 GeoJSON 并绘制等时圈 / edges / stations
secondMap.addSource('iso', {
  type: 'vector',
  url: 'mapbox://yallle0503.cwpwadpm'
});

['120min', '90min', '60min', '30min'].forEach(dur => {
  const validIds = sortedFeatures
    .filter(f => typeof f?.properties?.id === 'string' && f.properties.id.endsWith(dur))
    .map(f => f.properties.id);

  secondMap.addLayer({
    id: `iso-fill-${dur}`,
    type: 'fill',
    source: 'iso',
    'source-layer': 'all_isochrone1-de37z7',
    filter: ['match', ['get', 'id'], validIds, true, false],  // ✅ 只传纯字符串
    paint: {
      'fill-color': colorMap[+dur.replace('min','')],
      'fill-opacity': 0.4
    }
  }, 'waterway-label');

  secondMap.addLayer({
    id: `iso-line-${dur}`,
    type: 'line',
    source: 'iso',
    'source-layer': 'all_isochrone1-de37z7',
    filter: ['match', ['get', 'id'], validIds, true, false],  // ✅ 同样
    paint: {
      'line-color': colorMap[+dur.replace('min','')],
      'line-width': 1.2,
      'line-opacity': 0.9
    }
  }, 'waterway-label');
});


    secondMap.addSource('edges',{type:'vector',url:'mapbox://yallle0503.9bgonzwv'});
    secondMap.addLayer({
      id:'edges-line', type:'line', source:'edges', 'source-layer':'505network_edges-8juinw',
      paint:{
        'line-color':'#1e6bb3',
        'line-width':['interpolate',['linear'],['zoom'],3,0.5,8,1,13,1.5],
        'line-opacity':0.8
      }
    });

    secondMap.addSource('stations',{type:'vector',url:'mapbox://yallle0503.9g0hkfgi'});
    secondMap.addLayer({
      id:'stations-circle', type:'circle', source:'stations', 'source-layer':'505network_nodes-bv54ia',
      paint:{
        'circle-color':'#1e6bb3',
        'circle-radius':['interpolate',['linear'],['zoom'],4,0.25,6,1,13,4],
        'circle-opacity':0.8,
        'circle-stroke-width':0.8,
        'circle-stroke-color': '#ffffff'   
      }
    });
secondMap.addSource('all-points', {
  type: 'vector',
  url: 'mapbox://yallle0503.7lo41qw4'
});

secondMap.addLayer({
  id: 'all-points-layer',
  type: 'circle',
  source: 'all-points',
  'source-layer': 'green_assets_merged_avg_area-bc44su',
  paint: {
    'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 1, 6, 1.8, 13, 3],
    'circle-color': '#3EA46E',
    'circle-stroke-color': '#fff',
    'circle-stroke-width': 0.4
  }
  });
//
   // ✅ 图层添加后立即隐藏
  secondMap.setLayoutProperty('all-points-layer', 'visibility', 'none');
  secondMap.setLayoutProperty('edges-line', 'visibility', 'none');
  secondMap.setLayoutProperty('stations-circle', 'visibility', 'none');
  ['30min','60min','90min','120min'].forEach(dur => {
    secondMap.setLayoutProperty(`iso-fill-${dur}`, 'visibility', 'none');
    secondMap.setLayoutProperty(`iso-line-${dur}`, 'visibility', 'none');
  });

  // ✅ 所有图层控制按钮放这里
  document.getElementById('rail-toggle').addEventListener('change', function(e) {
    const visible = e.target.checked ? 'visible' : 'none';
    secondMap.setLayoutProperty('edges-line', 'visibility', visible);
    secondMap.setLayoutProperty('stations-circle', 'visibility', visible);
  });

  document.getElementById('green-toggle').addEventListener('change', function(e) {
    const visible = e.target.checked ? 'visible' : 'none';
    if (secondMap.getLayer('all-points-layer')) {
      secondMap.setLayoutProperty('all-points-layer', 'visibility', visible);
    }
  });
// updateMapAndCard(0);
  //开关
  // 铁路图层开关
document.getElementById('rail-toggle').addEventListener('change', function(e) {
  const visible = e.target.checked ? 'visible' : 'none';
  secondMap.setLayoutProperty('edges-line', 'visibility', visible);
  secondMap.setLayoutProperty('stations-circle', 'visibility', visible);
});

// 绿色图层开关
document.getElementById('green-toggle').addEventListener('change', function(e) {
  const visible = e.target.checked ? 'visible' : 'none';
  if (secondMap.getLayer('all-points-layer')) {
    secondMap.setLayoutProperty('all-points-layer', 'visibility', visible);
  }

});


    // 5) 鼠标 hover 城市时高亮对应等时圈
    durations.forEach(dur => {
      secondMap.on('mousemove', `iso-fill-${dur}`, handleHover);
      secondMap.on('mouseleave', `iso-fill-${dur}`, restoreAllLayers);
    });

    // 6) 图层开关（保持原样）
    document.querySelectorAll('#layer-toggle input[type=checkbox]').forEach(cb => {
      cb.addEventListener('change', () => {
        const fillId = `iso-fill-${cb.value}`;
        const lineId = `iso-line-${cb.value}`;
        const vis = cb.checked ? 'visible' : 'none';
        if (secondMap.getLayer(fillId)) secondMap.setLayoutProperty(fillId,'visibility',vis);
        if (secondMap.getLayer(lineId)) secondMap.setLayoutProperty(lineId,'visibility',vis);
      
      });
   
    });
  

  // ✅ 正确位置（放 initSecondMap() 内部，window.addEventListener 之后）
scrollStage = 0;
scrollDistance = 0;
cardContainer.innerHTML = '';
showNewCard(0);  // ✅ 只显示第一张卡片（对应 data-stage=0）
updateMapAndCard(0);  // ✅ 只初始化一次地图
      // ✅ 所有函数（包括 handleWheel）也放在 initSecondMap 里面
  window.addEventListener('wheel', handleWheel, { passive: false });



  })                    //结束**************************************
     //卡片
  function updateMapAndCard(stage) {
    if (stage > 8) return;  // ✅ 防止 maxStage + 1 时执行清除动作
    // ✅ 统一清除旧图层
  secondMap.setLayoutProperty('edges-line', 'visibility', 'none');
    secondMap.setLayoutProperty('stations-circle', 'visibility', 'none');
    ['30min','60min','90min','120min'].forEach(dur => {
      secondMap.setLayoutProperty(`iso-fill-${dur}`, 'visibility', 'none');
      secondMap.setLayoutProperty(`iso-line-${dur}`, 'visibility', 'none');
    });
    secondMap.setLayoutProperty('all-points-layer', 'visibility', 'none');
   
    d3.select('#layer-toggle').style('display', 'none');
  //
    const safeSet = (layerId, visibility = 'visible') => {
    if (secondMap.getLayer(layerId)) {
      secondMap.setLayoutProperty(layerId, 'visibility', visibility);
    }
  };
  
    // ✅ 分幕控制地图和图层
    if (stage === 0) {
      secondMap.setLayoutProperty('edges-line', 'visibility', 'visible');
      secondMap.setLayoutProperty('stations-circle', 'visibility', 'visible');
      secondMap.jumpTo({  center: [-1.8, 53.03], zoom: 6.1  });
  
    } else if (stage === 1) {
      secondMap.setLayoutProperty('iso-fill-30min', 'visibility', 'visible');
      secondMap.setLayoutProperty('iso-line-30min', 'visibility', 'visible');
      secondMap.jumpTo({  center: [-1.8, 53.03], zoom: 6.1 });
  
    } else if (stage === 2) {
      secondMap.setLayoutProperty('iso-fill-60min', 'visibility', 'visible');
      secondMap.setLayoutProperty('iso-line-60min', 'visibility', 'visible');
      secondMap.jumpTo({ center: [-1.8, 53.03], zoom: 6.1 });
  
    } else if (stage === 3) {
      secondMap.setLayoutProperty('iso-fill-90min', 'visibility', 'visible');
      secondMap.setLayoutProperty('iso-line-90min', 'visibility', 'visible');
      secondMap.jumpTo({ center: [-1.8, 53.03], zoom: 6.1 });
  
    } else if (stage === 4) {
      secondMap.setLayoutProperty('iso-fill-120min', 'visibility', 'visible');
      secondMap.setLayoutProperty('iso-line-120min', 'visibility', 'visible');
      secondMap.jumpTo({ center: [-1.8, 53.03], zoom: 6.1 });
  
    } else if (stage === 5) {
      ['30min','60min','90min','120min'].forEach(dur => {
        secondMap.setLayoutProperty(`iso-fill-${dur}`, 'visibility', 'visible');
        secondMap.setLayoutProperty(`iso-line-${dur}`, 'visibility', 'visible');
      });
      secondMap.setLayoutProperty('all-points-layer', 'visibility', 'visible');
      secondMap.flyTo({ center: [-1.8, 53.03], zoom: 6.1});
  
      setTimeout(() => {
 
        d3.select('#layer-toggle').style('display', 'block');
  
        setTimeout(() => {
          drawBubbleChart(recs);
          d3.selectAll('.city-btn').classed('active', false);
          d3.select('#controls button').filter(function() {
            return this.textContent === 'Show All';
          }).classed('active', true);
          filterCity(null);
        }, 100);
      }, 200);
    
        } else if (stage === 6) {
      ['30min','60min','90min','120min'].forEach(dur => {
        secondMap.setLayoutProperty(`iso-fill-${dur}`, 'visibility', 'visible');
        secondMap.setLayoutProperty(`iso-line-${dur}`, 'visibility', 'visible');
      });
      secondMap.setLayoutProperty('all-points-layer', 'visibility', 'visible');
      secondMap.flyTo({ center: [-0.0076, 51.3072], zoom: 8.1 });
  
      setTimeout(() => {

        d3.select('#layer-toggle').style('display', 'block');
  
        setTimeout(() => {
          drawBubbleChart(recs);
          d3.selectAll('.city-btn').classed('active', false);
          d3.select('#controls button').filter(function() {
            return this.textContent === 'Show All';
          }).classed('active', true);
          filterCity(null);
        }, 100);
      }, 200);
  
    
  
    } else if (stage === 7) {
    // ✅ 重新开启所有等时圈
    ['30min','60min','90min','120min'].forEach(dur => {
      secondMap.setLayoutProperty(`iso-fill-${dur}`, 'visibility', 'visible');
      secondMap.setLayoutProperty(`iso-line-${dur}`, 'visibility', 'visible');
    });
    
    secondMap.setLayoutProperty('all-points-layer', 'visibility', 'visible');
  
    secondMap.flyTo({ center: [-3.6518, 55.9642], zoom: 8.4 });
  
    setTimeout(() => {
      d3.select('#layer-toggle').style('display', 'block');
  
      setTimeout(() => {
        drawBubbleChart(recs);
        d3.selectAll('.city-btn').classed('active', false);
        d3.select('#controls button').filter(function() {
          return this.textContent === 'Show All';
        }).classed('active', true);
        filterCity(null);
      }, 100);
    }, 200);
  }else if (stage === 8) {
    // ✅ 同样开启所有图层
    ['30min','60min','90min','120min'].forEach(dur => {
      secondMap.setLayoutProperty(`iso-fill-${dur}`, 'visibility', 'visible');
      secondMap.setLayoutProperty(`iso-line-${dur}`, 'visibility', 'visible');
    });
    
    secondMap.setLayoutProperty('all-points-layer', 'visibility', 'visible');
  
    secondMap.flyTo({ center: [-1.8, 52.8], zoom: 6.1 });
  
    setTimeout(() => {

      d3.select('#layer-toggle').style('display', 'block');
  
      setTimeout(() => {
        drawBubbleChart(recs);
        d3.selectAll('.city-btn').classed('active', false);
        d3.select('#controls button').filter(function() {
          return this.textContent === 'Show All';
        }).classed('active', true);
        filterCity(null);
      }, 100);
    }, 200);
    }else if (stage === maxStage) {
    const nextSection = document.querySelector('#section3');
    if (nextSection) {
      setTimeout(() => {
        nextSection.scrollIntoView({ behavior: 'smooth' });
      }, 1000);
    }
  }

  
    
  }
   
 

  
  drawActivityBubbles();  // ⬅️ 页面一加载就执行
  //柱形图
  const activities = [
    { type: "Urban green space", percent: 52, activity: "Walking & Relaxing" },
    { type: "Forest", percent: 32, activity: "Hiking" },
    { type: "Fields / Farmland", percent: 32, activity: "Picnicking" },
    { type: "River/Lake/Canal", percent: 30, activity: "Swimming" },
    { type: "Beach/Coast/Sea", percent: 28, activity: "Coastal Walk" }
  ];
  
  const svg = d3.select("#activity-chart");
  const width = document.getElementById("activity-lines").clientWidth;
  const height = document.getElementById("activity-lines").clientHeight;
 const margin = { top: 100, right: 10, bottom: 40, left: 80 };  // ✅ 减少顶部间距
d3.select("#activity-lines").style("border", "1px dashed red");

  const lineLen = width * 0.6;
  const rowH = 56;
  svg.append("text")
    .attr("x", width * 0.08)  // ⬅️ 控制水平方向
    .attr("y", margin.top * 0.55)  // ⬅️ 控制垂直位置
    .attr("fill", "#5583c3")
    .attr("font-size", "18px")
    .attr("font-weight", "bold")
    .attr("text-anchor", "start")
    .style("pointer-events", "all")
    .selectAll("tspan")
    .data([
      "What are the most frequently visited nature destinations ?"
    ])
    .enter()
    .append("tspan")
    // ⬇️ 删除 .attr("x")，只设置相对垂直偏移
    .attr("dy", (d, i) => i === 0 ? "0em" : "1.3em")  // 垂直间距
    .text(d => d);
  
  
  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
  
  const color = "#B62957";
  activities.forEach((d, i) => {
    const y = i * rowH;
    const group = g.append("g");
    const targetX = lineLen * (d.percent / 100);
    // 1. 白线
    group.append("line")
      .attr("x1", 0).attr("x2", lineLen)
      .attr("y1", y).attr("y2", y)
      .attr("stroke", "#4c7ec4")
      .attr("stroke-width", 2);
  
    // 2. 红色泡泡 + 动画 + hover
    const circle = group.append("circle")
      .datum(d)
      .attr("cx", 0)
      .attr("cy", y)
      .attr("r", 9)
      .attr("fill", color)
      .style("cursor", "pointer")
      .style("opacity", 0.7);
  
    // 🚀 执行动画
    circle.transition()
    .duration(3500)
    .attr("cx", targetX)
    .on("end", function(_, i) {
      d3.select(this)
        .on("mouseover", function(event, d) {
          tooltip.style("visibility", "visible")
            .style("left", `${event.pageX + 10}px`)
            .style("top", `${event.pageY - 20}px`)
            .html(`<b>${d.type}</b><br>${d.activity}`);
        })
        .on("mouseout", () => {
          tooltip.style("visibility", "hidden");
        });
    });
  
  
    
  
    // 3. 上方文字（类型）✅ 白色
    group.append("text")
      .text(d.type)
      .attr("x", targetX)
      .attr("y", y - 15)
      .attr("fill", "#4c7ec4")
      .attr("text-anchor", "middle")
      .style("font-size", "13px")
      .transition()
      .delay(1500)
      .style("opacity", 1);
  
    // 4. 下方文字（百分比）✅ 白色
    group.append("text")
      .text(d.percent + "%")
      .attr("x", targetX)
      .attr("y", y + 25)
      .attr("fill", "#4c7ec4")
      .style("font-weight", "bold")  // ✅ 加粗
      .attr("text-anchor", "middle")
      .style("font-size", "13px")
      .transition()
      .delay(1200)
      .style("opacity", 1);
  });
  
  
function showNewCard(stage) {
  const newCard = document.createElement('div');
  newCard.className = 'card';
  newCard.setAttribute('data-stage', stage);
  newCard.innerHTML = textData[stage] || `Stage ${stage}`;

  // 初始完全位于屏幕底部外
  newCard.style.position = 'absolute';
  newCard.style.left = '50%';
  newCard.style.top = '100%';
  newCard.style.transform = 'translate(-50%, 0)';
  newCard.style.transition = 'none';

  cardContainer.appendChild(newCard);
}





  
  
    // ============================
    // drawBubbleChart 完整版本
    function drawBubbleChart(data) {
      // 清空
      d3.select('#bubble-chart').selectAll('*').remove();
      const margin = {l:50, r:20, t:40, b:20};
      const totalW = document.getElementById('bubble-chart').clientWidth* 0.4;
      const totalH = document.getElementById('bubble-chart').clientHeight* 0.4;
      const W = totalW - margin.l - margin.r;
      const H = totalH - margin.t - margin.b;
  
      const svg = d3.select('#bubble-chart')
        .append('svg')
          .attr('width', totalW)
          .attr('height', totalH)
        .append('g')
          .attr('transform', `translate(${margin.l},${margin.t})`);
  
      // scales
      const maxX = d3.max(data, d=>d.x),
            maxY = d3.max(data, d=>d.y),
            minY = d3.min(data, d=>d.y);
  
      const xScale = d3.scaleLinear().domain([0, maxX+20]).range([0, W]);
      const yScale = d3.scaleLinear().domain([minY-600, maxY+200]).range([H, 0]);
  
      // 气泡节点
      const nodes = data.map(d=>({
      props: d.props,      // ← 一定要保留这一行
      city: d.city,
      cx: xScale(d.x),
      cy: yScale(d.y),
      r: 10,
      color: d.color
    }));
  
      // 圆
      // **在 on('mouseover') 中，用 function(event,d) 拿到第二个参数 d**
      svg.selectAll('circle').data(nodes).join('circle')
        .attr('cx',d=>d.cx).attr('cy',d=>d.cy).attr('r',d=>d.r)
        .attr('fill',d=>d.color).attr('fill-opacity',0.5)
        .attr('stroke',d=>d.color).attr('stroke-width',2)
        .style('cursor','pointer')
        .on('mouseover', function(event, d) {
          // 放大
          d3.select(this)
            .transition().duration(200)
            .attr('r', d.r * 2.5);
  
          // **tooltip.style 现在是 d3 selection，正常可用**
          tooltip.html(
            `City: ${d.city}<br>`+
            `Points: ${d.props.total_points}<br>`+
            `Area: ${Math.round(d.props.total_green_area_buffered/1e6)} km²`
          )
          .style('left',  (event.pageX+10) + 'px')
          .style('top',   (event.pageY+10) + 'px')
          .style('visibility','visible');
          // 画 Donut
          drawRadialChart(d.props);
          })
          .on('mousemove', event=>{
            tooltip.style('left',(event.pageX+10)+'px')
                   .style('top',(event.pageY+10)+'px');
          })
          .on('mouseout', function(event, d) {
  d3.select(this).transition().duration(200).attr('r', d.r);
  tooltip.style('visibility','hidden');
  // 不清除 radial 图，让上一个图继续留着
});

  
      // 文本标签
      const labels = svg.selectAll('text.label').data(nodes).join('text')
        .attr('class','label')
        .text(d=>d.city)
        .attr('fill',   d=>d.color)
        .attr('stroke','#000')      // 黑色描边
        .attr('stroke-width',0.5)
        .style('paint-order','stroke')
        .attr('font-size',11)
        .attr('text-anchor','middle')
        .attr('x', d=>d.cx)
        .attr('y', d=>d.cy);
  
      // D3 力导避让
      d3.forceSimulation(nodes)
        .force('x',      d3.forceX(d=>d.cx).strength(0.1))
        .force('y',      d3.forceY(d=>d.cy).strength(0.1))
        .force('collide',d3.forceCollide(d=>d.r+8))
        .force('charge', d3.forceManyBody().strength(-5))
        .on('tick', ()=>{
          labels
            .attr('x', d=>d.x)
            .attr('y', d=>d.y);
        });
  
      // --- 坐标轴最后画，保证在最顶层 ---
      const axisColor = '#3e63c9';
  
      const xg = svg.append('g')
        .attr('transform', `translate(0,${H})`)
        .call(d3.axisBottom(xScale).ticks(5));
      const yg = svg.append('g')
        .call(d3.axisLeft(yScale).ticks(5));
  
      // 提升到最上层
      svg.selectAll('.x.axis, .y.axis').raise();
  
      // 应用颜色
      xg.selectAll('path').attr('stroke',axisColor);
      xg.selectAll('line').attr('stroke',axisColor);
      xg.selectAll('text').attr('fill', axisColor);
  
      yg.selectAll('path').attr('stroke',axisColor);
      yg.selectAll('line').attr('stroke',axisColor);
      yg.selectAll('text').attr('fill', axisColor);
      // 添加横轴标题：Points
  svg.append('text')
    .attr('x', W / 2)
    .attr('y', H + 28)
    .attr('text-anchor', 'middle')
    .style('font-size', '12px')
    .style('fill', axisColor)
    .text('Points');
  
  // 添加纵轴标题：Area
  svg.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -H / 3)
    .attr('y', -30)
    .attr('text-anchor', 'middle')
    .style('font-size', '12px')
    .style('fill', axisColor)
    .text('Area (km²)');
  
  
      // 暴露给 filter
      window._nodes  = nodes;
      window._labels = labels;
    }


    //



   function drawRadialChart(props) {
    const keys = [
      'parks','nature_reserves','protected_areas',
      'wood','scrub','wetlands','gardens',
      'forests','grassland','beaches','heaths'
    ];
  
    const data = keys.map(k => ({
      label: k.replace(/_/g, ' '),
      value: +props[k] || 0
    })).filter(d => d.value > 0)
      .sort((a, b) => a.value - b.value);
  
    const barH = 9
    const pad = 3;
    const innerR = 16;
    const margin = 34;
    const labelX = -100;
    const labelFont = 12;
    const maxAngle = 1.5 * Math.PI; // ⬅️ 最多 3/4 圆
    const maxV = d3.max(data, d => d.value) || 1;
  
    const layers = data.length;
    const outerR = innerR + layers * (barH + pad);
    const W = outerR * 2 + margin * 2;
    const H = outerR * 2 + margin * 2;
  
    const colorScale = d3.scaleLinear()
      .domain([4, 6, 12, 22])
      .range(['#ea7a57','#eda25b','#e4b947','#9db94a'])
      .clamp(true);
  
    const sel = d3.select('#radial-chart').html('');
    const svg = sel.append('svg')
      .attr('width', W)
      .attr('height', H)
      .append('g')
      .attr('transform', `translate(${W/2}, ${H/2})`);
  
    const startA = 0 ;
    
    data.forEach((d, i) => {
      const frac = d.value / maxV;
      const endA = startA + maxAngle * frac;
      const r0 = innerR + i * (barH + pad);
      const r1 = r0 + barH;
  
      // 弧形条
      svg.append('path')
        .attr('d', d3.arc()
          .innerRadius(r0)
          .outerRadius(r1)
          .startAngle(startA)
          .endAngle(endA)
          .cornerRadius(barH / 2)
        )
        .attr('fill', colorScale(d.value))
        .attr('fill-opacity', 0.9);
      });
  
      // 左上角文字
      const reversedData = [...data].reverse();
  
      reversedData.forEach((d, i) => {
    svg.append('text')
      .attr('x', labelX)
      .attr('y', -outerR + i * (barH + pad) + barH / 2)
      .attr('dy', '0.35em')
      .style('font', `${labelFont}px sans-serif`)
      .style('fill', colorScale(d.value))
      .text(`${d.label} ${d.value}`);
  });
  }
  
  
  
  
    function filterCity(city) {
      d3.selectAll('#bubble-chart circle')
        .attr('opacity', function(d){
          return city ? (d3.select(this).datum().city===city?1:0.1) : 1;
        });
      window._labels
        .attr('opacity', d=> city? (d.city===city?1:0.1):1 );
    }
  
    

      function drawActivityBubbles() {
        const container = document.getElementById('activity-bubbles');
        const width = container.clientWidth;
        const height = container.clientHeight;



  const svg = d3.select('#activity-bubbles')
  .append('svg')
  .attr('width', width)
  .attr('height', height);
    

    const radiusScale = d3.scaleLinear().domain([1, 10]).range([64, 34]);
    const colorScale = d3.scaleSequential()
  .domain([10, 1])
  .interpolator(d3.interpolateRgb("#1eaca1", "#FC7B4E")); // 红 → 黄

    const fontSizeScale = d3.scaleLinear()
    .domain([1, 10])     // rank 从 1 到 10
    .range([15, 9]);    // 字体从大到小（可以调整）
    const simulation = d3.forceSimulation(activityData)
      .force("x", d3.forceX(width / 5).strength(0.35))
      .force("y", d3.forceY(height / 2).strength(0.6))

      .force("collide", d3.forceCollide(d => radiusScale(d.rank) + 2))
      .on("tick", ticked);
const colorInterpolator = d3.interpolateRgbBasis([
  "#B62957",  // 起始色：玫红
  "#EA7A57",  // 中间色：橘红
  "#EEAA44"   // 结束色：金黄
]);



activityData.forEach(d => {
  const t = (d.rank - 1) / 9;
  d.color = colorInterpolator(t);
});




    const nodes = svg.selectAll('g')
      .data(activityData)
      .enter()
      .append('g')
      .style('opacity', 0)
      .transition().duration(800)
      .delay((d, i) => i * 80)
      .style('opacity', 1);

    const group = svg.selectAll('g')
      .data(activityData);

    group.append('circle')
       .attr('r', 0)  // 从半径 0 开始
  .attr('fill', d => d.color)
  .attr('stroke', '#fff')
  .attr('stroke-width', 2)
  .transition()
  .duration(800)
  .ease(d3.easeBounceOut)  // 弹跳感效果
  .attr('r', d => radiusScale(d.rank))  // 最终大小
      .attr('fill-opacity', 0.8);
    

    const texts = group.append('text')
  .attr('text-anchor', 'middle')
  .style('fill', '#fff')
  .style('font-size', d => fontSizeScale(d.rank) + 'px');
console.log("🎈 bubble SVG appended:", document.querySelector("#activity-bubbles svg"));
d3.select("#activity-bubbles").style("border", "1px dashed blue");




texts.each(function(d) {
  const lines = d.activity.split('\n');
  lines.forEach((line, i) => {
    d3.select(this).append('tspan')
      .text(line)
      .attr('x', 0)
      .attr('dy', i === 0 ? '0.35em' : '1.2em');
    
  });
});


   function drawRadialChart(props) {
    const keys = [
      'Parks','Nature Reserves','Protected Areas',
      'Wood','Scrub','Wetlands','Gardens',
      'Forests','Grassland','Beaches','Heaths'
    ];
  
    const data = keys.map(k => ({
      label: k.replace(/_/g, ' '),
      value: +props[k] || 0
    })).filter(d => d.value > 0)
      .sort((a, b) => a.value - b.value);
  
    const barH = 12;
    const pad = 10;
    const innerR = 25;
    const margin = 65;
    const labelX = -100;
    const labelFont = 12;
    const maxAngle = 1.5 * Math.PI; // ⬅️ 最多 3/4 圆
    const maxV = d3.max(data, d => d.value) || 1;
  
    const layers = data.length;
    const outerR = innerR + layers * (barH + pad);
    const W = outerR * 2 + margin * 2;
    const H = outerR * 2 + margin * 2;
  
    const colorScale = d3.scaleLinear()
      .domain([4, 6, 12, 22])
      .range(['#c3b602','#d49c03','#ca6104','#af023c'])
      .clamp(true);
  
    const sel = d3.select('#radial-chart').html('');
    const svg = sel.append('svg')
      .attr('width', W)
      .attr('height', H)
      .append('g')
      .attr('transform', `translate(${W/2}, ${H/2})`);
  
    const startA = 0 ;
    
    data.forEach((d, i) => {
      const frac = d.value / maxV;
      const endA = startA + maxAngle * frac;
      const r0 = innerR + i * (barH + pad);
      const r1 = r0 + barH;
  
      // 弧形条
      svg.append('path')
        .attr('d', d3.arc()
          .innerRadius(r0)
          .outerRadius(r1)
          .startAngle(startA)
          .endAngle(endA)
          .cornerRadius(barH / 2)
        )
        .attr('fill', colorScale(d.value))
        .attr('fill-opacity', 0.7);
      });
  
      // 左上角文字
      const reversedData = [...data].reverse();
  
      reversedData.forEach((d, i) => {
    svg.append('text')
      .attr('x', labelX)
      .attr('y', -outerR + i * (barH + pad) + barH / 2)
      .attr('dy', '0.35em')
      .style('font', `${labelFont}px sans-serif`)
      .style('fill', colorScale(d.value))
      .text(`${d.label} ${d.value}`);
  });
  }
  
  
    function filterCity(city) {
      d3.selectAll('#bubble-chart circle')
        .attr('opacity', function(d){
          return city ? (d3.select(this).datum().city===city?1:0.1) : 1;
        });
      window._labels
        .attr('opacity', d=> city? (d.city===city?1:0.1):1 );
    }
  
    
  
    function ticked() {
      group.attr('transform', d => `translate(${d.x},${d.y})`);
    }
  }


function handleHover(e) {
  secondMap.getCanvas().style.cursor = 'pointer';
  if (!e.features || !e.features.length) return;

  const hoveredId = e.features[0].properties.id;
  const cityPrefix = hoveredId.split('_')[0];

  durations.forEach(dur => {
    const layerId = `iso-fill-${dur}`;
    const lineId = `iso-line-${dur}`;

    // 设置 fill 图层透明度
    secondMap.setPaintProperty(layerId, 'fill-opacity', [
      'case',
      ['==', ['slice', ['get', 'id'], 0, cityPrefix.length], cityPrefix],
      0.2,   // 当前 hover 城市保持正常透明度
      0.03   // 其他城市虚化
    ]);

    // 设置线图层透明度（可选）
    secondMap.setPaintProperty(lineId, 'line-opacity', [
      'case',
      ['==', ['slice', ['get', 'id'], 0, cityPrefix.length], cityPrefix],
      0.8,
      0.05
    ]);
  });
}
}



  // ✅ 放在这里（initSecondMap 函数末尾、on(load) 外部）

