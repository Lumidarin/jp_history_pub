(() => {
  'use strict';
  const $=id=>document.getElementById(id), reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(typeof d3==='undefined'){
    $('start-film').disabled=true;$('start-card').querySelector('p').textContent='地图组件未能加载，请检查网络后刷新。正文和章节数据仍保留在页面中。';return;
  }
  const colors={latin:'#dca169',seljuk:'#67aea4',ayyubid:'#67aea4',fatimid:'#67aea4',mamluk:'#67aea4',byzantine:'#a39acc'};
  const projection=d3.geoMercator().center([24,37]).scale(950).translate([600,380]);
  const geoPath=d3.geoPath(projection), svg=d3.select('#atlas'), defs=svg.append('defs');
  defs.append('pattern').attr('id','sea-grid').attr('width',80).attr('height',80).attr('patternUnits','userSpaceOnUse').append('path').attr('d','M 80 0 L 0 0 0 80').attr('fill','none').attr('stroke','#789c9520').attr('stroke-width',.5);
  svg.append('rect').attr('width',1200).attr('height',760).attr('fill','#142f34');
  svg.append('rect').attr('width',1200).attr('height',760).attr('fill','url(#sea-grid)');
  Object.entries(colors).forEach(([side,color])=>defs.append('marker').attr('id','film-arrow-'+side).attr('viewBox','0 0 10 10').attr('refX',8).attr('refY',5).attr('markerWidth',5).attr('markerHeight',5).attr('orient','auto').append('path').attr('d','M 0 0 L 10 5 L 0 10 z').attr('fill',color));
  const root=svg.append('g'), land=root.append('g'), areas=root.append('g'), river=root.append('g'), labels=root.append('g'), routes=root.append('g'), marks=root.append('g'), battleGroup=root.append('g');
  land.selectAll('path').data(WORLD_LAND.features).join('path').attr('d',geoPath).attr('fill','#40554b').attr('stroke','#80907a').attr('stroke-width',.8).attr('vector-effect','non-scaling-stroke');
  const riverPaths=[[[31.24,30.04],[31.32,30.44],[31.38,31.04],[31.81,31.42]],[[35.6,33.1],[35.55,32.82],[35.57,32.5],[35.55,31.5]]];
  river.selectAll('path').data(riverPaths).join('path').attr('d',d=>d3.line().curve(d3.curveCatmullRom)(d.map(projection))).attr('fill','none').attr('stroke','#6ca7a8').attr('stroke-width',1.7).attr('vector-effect','non-scaling-stroke');
  const names=[['西 欧',6,48],['意大利',12.5,42.7],['巴尔干',22,43],['安纳托利亚',32.7,39.8],['叙利亚',38,34.8],['埃 及',29,28.5],['北 非',8,31],['地 中 海',19,35],['黑 海',33,43.5]];
  labels.selectAll('text').data(names).join('text').attr('x',d=>projection(d.slice(1))[0]).attr('y',d=>projection(d.slice(1))[1]).attr('text-anchor','middle').attr('fill',d=>d[0].includes('海')?'#8cadab':'#b0ba9e').attr('opacity',.6).attr('font-size',15).attr('letter-spacing',3).text(d=>d[0]);
  // Broad illustrative zones: intentionally not presented as reconstructed borders.
  const zones={
    byzantine:{color:colors.byzantine,coords:[[19,40],[23,43],[29,42],[31,40],[28,37],[25,37],[22,38]]},
    seljuk:{color:colors.seljuk,coords:[[29.5,40.1],[31,41],[38,39],[39,37],[35,36.8],[31,38]]},
    latin:{color:colors.latin,coords:[[34.8,31.4],[35.5,31.7],[35.65,33.5],[36.7,36.5],[39,37.3],[38.3,37.5],[35.8,36.5],[35.4,34],[35.1,32.6]]},
    syrian:{color:colors.seljuk,coords:[[36,32.4],[39,33],[40,37.7],[37,38.5],[35.8,35.8]]},
    ayyubid:{color:colors.ayyubid,coords:[[28.5,29],[32.5,29],[35.5,31],[36.8,33.8],[39.5,36.8],[36.9,37],[35.8,34],[34.4,31.8],[30,31.7]]},
    coast:{color:colors.latin,coords:[[34.7,32],[35,32],[35.35,33.4],[35.15,33.4],[34.7,32.2]]},
    mamluk:{color:colors.mamluk,coords:[[28.5,29],[32.5,29],[36,31],[38,34],[39.5,37],[35.8,36.9],[35.1,33],[30,31.7]]}
  };
  let current={x:0,y:0,k:1},from={...current},target={...current},activeScene=null,imageReady=false;
  const point=id=>projection(CRUSADES.places[id].slice(1));
  const camera=view=>{const p=projection(view.slice(0,2)),k=view[2];return{x:600-p[0]*k,y:380-p[1]*k,k};};
  function sceneCamera(scene){
    if(!scene.battle)return camera(scene.view);
    const pts=scene.battle.units.flatMap(unit=>[projection(unit.from),projection(unit.to)]);
    const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);
    const x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);
    const k=Math.min(400,Math.min(680/Math.max(x1-x0,1.5),380/Math.max(y1-y0,1.5)));
    return{x:600-(x0+x1)/2*k,y:380-(y0+y1)/2*k,k};
  }
  function render(chapterIndex,sceneIndex){
    const chapter=CRUSADES.chapters[chapterIndex],scene=chapter.scenes[sceneIndex];activeScene=scene;from={...current};target=sceneCamera(scene);
    $('chapter-number').textContent=`${String(chapterIndex+1).padStart(2,'0')} / 12`;
    $('scene-number').textContent=`${String(sceneIndex+1).padStart(2,'0')} / ${String(chapter.scenes.length).padStart(2,'0')}`;
    $('chapter-title').textContent=chapter.title;$('chapter-summary').textContent=chapter.summary;$('scene-title').textContent=scene.title;$('scene-date').textContent=scene.when;$('narration').textContent=scene.narration;
    $('map-year').textContent=scene.when;$('map-kicker').textContent=`第 ${chapterIndex+1} 章 · ${chapter.title}`;
    $('people-list').replaceChildren(...chapter.people.map(text=>Object.assign(document.createElement('li'),{textContent:text})));
    $('sources-list').replaceChildren(...chapter.sources.map(id=>{const source=CRUSADES.sources[id],li=document.createElement('li'),a=Object.assign(document.createElement('a'),{textContent:source.title,href:source.url,target:'_blank',rel:'noopener noreferrer'});li.append(a);return li;}));
    $('source-map-note').textContent=CRUSADES.mapNote;
    $('history-image').hidden=!scene.image;
    imageReady=false;$('film-still').hidden=true;
    if(scene.image){const image=CRUSADES.images[scene.image];$('image').hidden=false;$('image-error').hidden=true;$('image').alt=image.title;$('image-link').href=image.source;$('image-title').textContent=image.title;$('image-caption').textContent=image.caption;$('image-credit').textContent=image.credit;$('image').src=image.src;$('film-still-image').src=image.src;$('film-still-image').alt=image.title;$('film-still-caption').textContent=image.caption;}
    $('image').onerror=()=>{$('image').hidden=true;$('image-error').hidden=false;};
    $('image').onload=()=>{$('image').hidden=false;$('image-error').hidden=true;};
    $('film-still-image').onload=()=>{imageReady=true;if(window.historyFilm)animate(window.historyFilm.progress);};
    $('film-still-image').onerror=()=>{imageReady=false;$('film-still').hidden=true;};
    $('battle-heading').hidden=!scene.battle;$('battle-heading').textContent=scene.battle?.title||'';
    $('map-disclaimer').textContent=scene.battle?scene.battle.note:'海岸线为真实地理轮廓；势力、路线与战场队形为示意。';
    areas.selectAll('*').remove();
    for(const id of scene.areas||[]){const z=zones[id];areas.append('path').attr('d',d3.line()(z.coords.map(projection))+'Z').attr('fill',z.color).attr('fill-opacity',.15).attr('stroke',z.color).attr('stroke-opacity',.45).attr('stroke-dasharray','6 5').attr('vector-effect','non-scaling-stroke');}
    routes.selectAll('*').remove();
    for(const route of scene.routes||[]){const pts=route.places.map(point),color=colors[route.side]||colors.latin;
      routes.append('path').attr('class','film-route').attr('d',d3.line().curve(d3.curveCatmullRom)(pts)).attr('fill','none').attr('stroke',color).attr('stroke-width',2.7).attr('marker-end',`url(#film-arrow-${route.side})`).attr('vector-effect','non-scaling-stroke');
    }
    marks.selectAll('*').remove();
    for(const id of scene.markers){const p=point(id),g=marks.append('g').attr('transform',`translate(${p[0]},${p[1]})`);g.append('circle').attr('r',4).attr('fill','#e7cf9d').attr('stroke','#182c2d');g.append('text').attr('dx',8).attr('dy',-8).attr('fill','#f1e3bf').attr('font-size',13).attr('paint-order','stroke').attr('stroke','#193033').attr('stroke-width',3).attr('stroke-linejoin','round').text(CRUSADES.places[id][0]);}
    battleGroup.selectAll('*').remove();
    if(scene.battle){
      for(const unit of scene.battle.units){
        const a=projection(unit.from),b=projection(unit.to),color=colors[unit.side];
        if(a[0]!==b[0]||a[1]!==b[1])battleGroup.append('path').attr('class','battle-vector').attr('d',`M${a}L${b}`).attr('fill','none').attr('stroke',color).attr('stroke-width',2).attr('stroke-dasharray','5 4').attr('opacity',.5).attr('marker-end',`url(#film-arrow-${unit.side})`).attr('vector-effect','non-scaling-stroke');
        const g=battleGroup.append('g').datum({unit,a,b}).attr('class','battle-unit');
        g.append('rect').attr('x',-10).attr('y',-7).attr('width',20).attr('height',14).attr('rx',2).attr('fill',color).attr('stroke','#f3edcf').attr('stroke-width',1);
        g.append('text').attr('x',13).attr('y',17).attr('font-size',14).attr('fill',color).attr('paint-order','stroke').attr('stroke','#152c30').attr('stroke-width',3).text(unit.name);
      }
    }
    $('chapter-list').querySelectorAll('button').forEach((btn,i)=>{btn.classList.toggle('active',i===chapterIndex);btn.setAttribute('aria-current',i===chapterIndex?'true':'false');});
    document.querySelector('.story-panel').scrollTop=0;
    history.replaceState(null,'',`#${chapter.id}.${scene.id}`);
  }
  function animate(progress){
    $('film-still').hidden=!activeScene?.image||!imageReady||progress>.32;
    const f=reduced?1:d3.easeCubicInOut(Math.min(1,progress*9));current={x:from.x+(target.x-from.x)*f,y:from.y+(target.y-from.y)*f,k:from.k+(target.k-from.k)*f};
    root.attr('transform',`translate(${current.x},${current.y}) scale(${current.k})`);
    marks.selectAll('circle').attr('r',4/current.k).attr('stroke-width',1/current.k);
    marks.selectAll('text').attr('font-size',13/current.k).attr('dx',8/current.k).attr('dy',-8/current.k).attr('stroke-width',3/current.k);
    labels.selectAll('text').attr('font-size',15/Math.sqrt(current.k)).attr('opacity',current.k>10?0:current.k>4?.2:.6);
    routes.selectAll('.film-route').each(function(){const length=this.getTotalLength();this.style.strokeDasharray=length;this.style.strokeDashoffset=length*(1-Math.min(1,(reduced?1:progress)*2));});
    const action=reduced?1:d3.easeCubicInOut(Math.max(0,Math.min(1,(progress-.15)/.65)));
    battleGroup.selectAll('.battle-unit').attr('transform',d=>`translate(${d.a[0]+(d.b[0]-d.a[0])*action},${d.a[1]+(d.b[1]-d.a[1])*action}) scale(${1/current.k})`);
  }
  const [chapterId,sceneId]=location.hash.slice(1).split('.');let c=CRUSADES.chapters.findIndex(x=>x.id===chapterId),s=0;
  if(c>=0)s=Math.max(0,CRUSADES.chapters[c].scenes.findIndex(x=>x.id===sceneId));
  else{try{const saved=JSON.parse(localStorage.getItem('crusades-film-pos'));if(Array.isArray(saved)){c=+saved[0];s=+saved[1];}}catch(_){}c=Math.max(0,c);}
  const hideStart=()=>{$('start-card').hidden=true;};
  const player=new HistoryPlayer({chapters:CRUSADES.chapters,render,animate,key:'crusades-film-pos',start:[c,s],onPlay:hideStart});window.historyFilm=player;
  // Initial still frame shows the selected location before the first click.
  current=sceneCamera(player.current());from={...current};target={...current};animate(0);
  const setDrawer=open=>{$('chapter-drawer').hidden=!open;$('toc-button').setAttribute('aria-expanded',open);if(open)$('toc-close').focus();else $('toc-button').focus();};
  CRUSADES.chapters.forEach((chapter,index)=>{const btn=document.createElement('button');btn.type='button';const no=document.createElement('span');no.textContent=String(index+1).padStart(2,'0');const text=document.createElement('span');text.textContent=chapter.title;const when=document.createElement('small');when.textContent=chapter.when;text.append(when);btn.append(no,text);btn.classList.toggle('active',index===player.chapter);btn.onclick=()=>{player.setScene(index,0,player.playing);setDrawer(false);};$('chapter-list').append(btn);});
  $('start-film').onclick=()=>player.play();$('toc-button').onclick=()=>setDrawer($('chapter-drawer').hidden);$('toc-close').onclick=()=>setDrawer(false);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('chapter-drawer').hidden)setDrawer(false);});
  window.addEventListener('hashchange',()=>{const [cid,sid]=location.hash.slice(1).split('.');const ci=CRUSADES.chapters.findIndex(x=>x.id===cid);if(ci<0)return;const si=CRUSADES.chapters[ci].scenes.findIndex(x=>x.id===sid);player.setScene(ci,Math.max(0,si),false);});
})();
