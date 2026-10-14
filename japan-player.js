(() => {
  'use strict';
  if(typeof CHAPTERS==='undefined'||!window.HistoryPlayer)return;
  document.body.classList.add('japan-with-cinema');
  const nav=document.createElement('nav');nav.className='japan-cinema-nav';nav.innerHTML='<a href="index.html">‹ 总目录</a><span>第一部 · 日本的历史</span><a href="crusades.html">第二部 · 十字军 ↗</a>';document.body.append(nav);
  const plain=html=>{const el=document.createElement('div');el.innerHTML=html;el.querySelectorAll('p,h4,li').forEach(p=>p.append(document.createTextNode('\n')));return el.textContent.trim();};
  const chapters=CHAPTERS.map((chapter,c)=>{
    const scenes=[];
    for(const [s,stage] of chapter._stages.entries()){
      if(stage._timeline)continue;
      const narration=plain(stage.html||'')||`${chapter.title}。${stage.title}。`;
      scenes.push({id:stage.id,title:stage.title,narration,duration:Math.max(14,narration.length/4+3),c,s,view:stage.view||chapter.view});
      for(const battle of chapter.battles||[]){
        if(battle.stage&&battle.stage!==stage.id)continue;
        if(!battle.stage&&s!==0)continue;
        const texts=[battle.terrain,...battle.phases.map(p=>p.desc),battle.outcome];
        const titles=['战前形势与地形',...battle.phases.map(p=>p.title),'结果与影响'];
        texts.forEach((text,pi)=>{const narration=plain(text||'')||`${battle.name}。${titles[pi]}。`;scenes.push({id:`${stage.id}~${battle.id}.${pi}`,title:`${battle.name} · ${titles[pi]}`,narration,duration:Math.max(14,narration.length/4+3),c,s,battle,pi});});
      }
    }
    return{title:chapter.title,scenes};
  });
  let cameraStart=null;
  const render=(c,index)=>{
    const scene=chapters[c].scenes[index];
    go(c,scene.s,{instant:true});
    if(scene.battle){openBattle(CHAPTERS[c],scene.battle,scene.pi);cameraStart=null;}
    else{
      cameraStart=viewTransform(scene.view||null);
    }
  };
  const player=new HistoryPlayer({chapters,render,key:'japan-film-pos',start:[ci,Math.max(0,chapters[ci].scenes.findIndex(x=>x.s===si&&(BV.open?x.battle?.id===BV.b.id&&x.pi===BV.pi:!x.battle)))],animate:p=>{
    if(BV.open)return;
    if(cameraStart){const k=cameraStart.k*(1+.04*p),w=wrapEl.clientWidth,h=wrapEl.clientHeight;const ratio=k/cameraStart.k;const t=d3.zoomIdentity.translate(w/2-(w/2-cameraStart.x)*ratio,h/2-(h/2-cameraStart.y)*ratio).scale(k);svg.call(zoom.transform,t);}
  }});window.historyFilm=player;
  const help=document.getElementById('helpcard');if(help)help.hidden=true;
  document.getElementById('help-btn').setAttribute('aria-expanded','false');
  // Preserve manual exploration; any map/phase interaction pauses the film.
  document.querySelector('.app').addEventListener('pointerdown',()=>{if(player.playing)player.pause();});
  document.querySelector('.app').addEventListener('click',()=>{
    if(player.playing)return;
    const match=chapters[ci].scenes.findIndex(x=>x.s===si&&(BV.open?x.battle?.id===BV.b.id&&x.pi===BV.pi:!x.battle));
    if(match>=0&&(player.chapter!==ci||player.scene!==match))player.setScene(ci,match,false);
  });
  document.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Escape'].includes(e.key)&&player.playing)player.pause();});
  setupZoom();goView(curView(),true);
})();
