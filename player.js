/* A single clock owns map motion, narration, pause, seeking and chapter changes. */
(() => {
  'use strict';
  const el = (tag, props = {}, text = '') => Object.assign(document.createElement(tag), props, {textContent:text});
  const clamp = (x,a,b) => Math.max(a,Math.min(b,x));
  class HistoryPlayer {
    constructor({chapters,render,animate=()=>{},key,start=[0,0],onPlay=()=>{}}) {
      Object.assign(this,{chapters,render,animate,key,onPlay});
      this.chapter=0;this.scene=0;this.progress=0;this.playing=false;this.rate=1;this.narrate=true;this.continuous=true;
      this.elapsed=0;this.token=0;this.speechDone=true;this.lastTime=0;this.chunkIndex=0;this.utterance=null;
      this.synth=window.speechSynthesis;this.voices=[];this.voice=null;this.voiceMode=false;
      this.buildControls();
      this.loadVoices();
      if(this.synth)this.synth.addEventListener('voiceschanged',()=>{this.loadVoices();if(this.playing&&this.narrate&&!this.voiceMode&&this.voice)this.restartSpeech();});
      this.setScene(start[0],start[1],false);
      document.addEventListener('visibilitychange',()=>{if(document.hidden&&this.playing){this.pause();this.status.textContent='页面已切到后台，播放已暂停；返回后可继续。';}});
      window.addEventListener('pagehide',()=>{this.token++;this.synth?.cancel();cancelAnimationFrame(this.frame);});
      document.addEventListener('keydown',e=>{if(e.target.closest('input,select,textarea,button,a')||e.ctrlKey||e.metaKey||e.altKey)return;if(e.code==='Space'){e.preventDefault();this.toggle();}});
    }
    buildControls(){
      const dock=el('section',{className:'cinema-dock','ariaLabel':'自动播放控制'});
      const top=el('div',{className:'cinema-topline'});this.caption=el('div',{className:'cinema-caption'});this.counter=el('span',{className:'cinema-counter'});top.append(this.caption,this.counter);
      const controls=el('div',{className:'cinema-controls'});
      this.prev=el('button',{type:'button',ariaLabel:'上一幕'},'‹');this.playButton=el('button',{type:'button',className:'cinema-play'},'▶ 播放');this.next=el('button',{type:'button',ariaLabel:'下一幕'},'›');
      this.seek=el('input',{type:'range',min:'0',max:'1000',value:'0',className:'cinema-seek',ariaLabel:'当前场景进度'});
      this.chapterSelect=el('select',{className:'cinema-chapters',ariaLabel:'选择章节'});this.chapters.forEach((c,i)=>this.chapterSelect.add(new Option(`${String(i+1).padStart(2,'0')} ${c.title}`,i)));
      this.audioButton=el('button',{type:'button',className:'cinema-audio',ariaPressed:'true'},'朗读 开');
      this.rateSelect=el('select',{className:'cinema-rate',ariaLabel:'播放速度'});[.75,1,1.25,1.5,2].forEach(r=>this.rateSelect.add(new Option(`${r}×`,r,r===1,r===1)));
      const auto=el('label');this.autoCheck=el('input',{type:'checkbox',checked:true});auto.append(this.autoCheck,document.createTextNode('连续换章'));
      controls.append(this.prev,this.playButton,this.next,this.seek,this.chapterSelect,this.audioButton,this.rateSelect,auto);
      this.status=el('p',{className:'cinema-voice-status',role:'status'});dock.append(top,controls,this.status);document.body.append(dock);
      if(window.ResizeObserver)new ResizeObserver(()=>document.documentElement.style.setProperty('--cinema-height',dock.getBoundingClientRect().height+'px')).observe(dock);
      this.prev.onclick=()=>this.move(-1);this.next.onclick=()=>this.move(1);this.playButton.onclick=()=>this.toggle();
      this.chapterSelect.onchange=()=>this.setScene(+this.chapterSelect.value,0,this.playing);
      this.seek.oninput=()=>this.seekTo(+this.seek.value/1000);
      this.audioButton.onclick=()=>{this.narrate=!this.narrate;this.audioButton.textContent='朗读 '+(this.narrate?'开':'关');this.audioButton.setAttribute('aria-pressed',this.narrate);this.restartSpeech();this.updateStatus();};
      this.rateSelect.onchange=()=>{this.rate=+this.rateSelect.value;this.restartSpeech();};
      this.autoCheck.onchange=()=>this.continuous=this.autoCheck.checked;
    }
    current(){return this.chapters[this.chapter].scenes[this.scene];}
    loadVoices(){
      this.voices=this.synth?this.synth.getVoices():[];
      this.voice=this.voices.find(v=>/^zh[-_]CN$/i.test(v.lang))||this.voices.find(v=>/^zh/i.test(v.lang))||null;
      this.updateStatus();
    }
    updateStatus(){
      this.status.textContent=!this.narrate?'字幕模式：地图与章节仍自动推进。':this.voice?`中文朗读 · ${this.voice.name} · 地图与章节自动推进`:'设备暂未提供中文声音，当前使用字幕模式；安装中文系统语音后可重新播放。';
    }
    setScene(c,s,play=false){
      this.token++;this.synth?.cancel();cancelAnimationFrame(this.frame);this.playing=false;
      this.chapter=clamp(Number.isFinite(+c)?Math.trunc(+c):0,0,this.chapters.length-1);this.scene=clamp(Number.isFinite(+s)?Math.trunc(+s):0,0,this.chapters[this.chapter].scenes.length-1);
      this.elapsed=0;this.progress=0;this.chunkIndex=0;this.speechDone=true;this.voiceMode=false;
      const scene=this.current();this.chunks=scene.narration.match(/[^。！？.!?\n]+[。！？.!?]?/g)||[scene.narration];
      // Very long Japanese paragraphs are split so the browser speech queue remains responsive.
      this.chunks=this.chunks.flatMap(x=>x.match(/[\s\S]{1,120}/g)||[]);
      this.subtitleChunks=this.chunks.flatMap(x=>x.match(/[\s\S]{1,40}/g)||[]);
      this.render(this.chapter,this.scene);this.animate(0);this.caption.textContent=scene.title;this.chapterSelect.value=this.chapter;
      this.playButton.textContent='▶ 播放';this.playButton.setAttribute('aria-pressed','false');this.seek.value=0;this.updateCounter();
      this.prev.disabled=this.chapter===0&&this.scene===0;this.next.disabled=this.chapter===this.chapters.length-1&&this.scene===this.chapters[this.chapter].scenes.length-1;
      try{localStorage.setItem(this.key,JSON.stringify([this.chapter,this.scene]));}catch(_){}
      if(play)this.play();
    }
    play(){
      if(this.playing)return;
      if(this.progress>=1)this.seekTo(0);
      this.onPlay();this.playing=true;this.lastTime=performance.now();this.playButton.textContent='Ⅱ 暂停';this.playButton.setAttribute('aria-pressed','true');
      this.loadVoices();this.startSpeech();this.frame=requestAnimationFrame(t=>this.tick(t));
    }
    pause(){
      this.playing=false;cancelAnimationFrame(this.frame);this.token++;this.synth?.cancel();
      this.playButton.textContent='▶ 继续';this.playButton.setAttribute('aria-pressed','false');
    }
    toggle(){this.playing?this.pause():this.play();}
    seekTo(progress){
      this.progress=clamp(progress,0,.999);this.elapsed=this.progress*this.current().duration*1000;
      this.chunkIndex=Math.min(this.chunks.length-1,Math.floor(this.progress*this.chunks.length));
      this.animate(this.progress);this.seek.value=Math.round(this.progress*1000);this.updateCounter();this.restartSpeech();
    }
    restartSpeech(){this.token++;this.synth?.cancel();this.speechDone=true;this.voiceMode=false;if(this.playing)this.startSpeech();}
    startSpeech(){
      if(!this.narrate||!this.synth||!this.voice){this.speechDone=true;this.voiceMode=false;return;}
      this.voiceMode=true;this.speechDone=false;const token=++this.token;
      const speak=()=>{
        if(token!==this.token||!this.playing)return;
        if(this.chunkIndex>=this.chunks.length){this.speechDone=true;this.utterance=null;return;}
        const utter=new SpeechSynthesisUtterance(this.chunks[this.chunkIndex]);this.utterance=utter;
        utter.lang=this.voice.lang;utter.voice=this.voice;utter.rate=this.rate;utter.volume=1;
        utter.onstart=()=>{if(token===this.token){this.caption.textContent=this.chunks[this.chunkIndex];this.speechStarted=performance.now();}};
        utter.onend=()=>{if(token===this.token){this.chunkIndex++;speak();}};
        utter.onerror=e=>{if(token!==this.token)return;this.speechDone=true;this.voiceMode=false;this.status.textContent='中文朗读未能播放，已切到字幕模式。可关闭再开启朗读重试。';};
        this.speechStarted=performance.now();this.synth.speak(utter);
      };speak();
    }
    tick(time){
      if(!this.playing)return;
      this.elapsed+=Math.min(time-this.lastTime,1000)*this.rate;this.lastTime=time;
      this.progress=clamp(this.elapsed/(this.current().duration*1000),0,1);this.animate(this.progress);this.seek.value=Math.round(this.progress*1000);this.updateCounter();
      if(!this.voiceMode)this.caption.textContent=this.subtitleChunks[Math.min(this.subtitleChunks.length-1,Math.floor(this.progress*this.subtitleChunks.length))];
      if(this.voiceMode&&!this.speechDone&&time-this.speechStarted>90000/this.rate){this.token++;this.synth.cancel();this.speechDone=true;this.voiceMode=false;this.status.textContent='朗读服务未响应，已用字幕继续播放。';}
      // Voice completion is authoritative. The estimate cannot cut a sentence short.
      if((this.voiceMode&&this.speechDone&&this.elapsed>3000)||(!this.voiceMode&&this.progress>=1)){
        if(this.scene+1<this.chapters[this.chapter].scenes.length){this.setScene(this.chapter,this.scene+1,true);return;}
        if(this.continuous&&this.chapter+1<this.chapters.length){this.setScene(this.chapter+1,0,true);return;}
        this.progress=1;this.seek.value=1000;this.animate(1);this.pause();this.playButton.textContent='↻ 重播';this.status.textContent=this.chapter===this.chapters.length-1?'本部已播放完。可选章节重看，或返回总目录。':'本章已播放完。开启连续换章后可接着观看。';return;
      }
      this.frame=requestAnimationFrame(t=>this.tick(t));
    }
    move(dir){
      let c=this.chapter,s=this.scene+dir;
      if(s<0){if(c===0)return;c--;s=this.chapters[c].scenes.length-1;}
      if(s>=this.chapters[c].scenes.length){if(c+1>=this.chapters.length)return;c++;s=0;}
      this.setScene(c,s,this.playing);
    }
    updateCounter(){
      this.counter.textContent=`第 ${this.chapter+1}/${this.chapters.length} 章 · 第 ${this.scene+1}/${this.chapters[this.chapter].scenes.length} 幕 · ${Math.round(this.progress*100)}%`;
    }
  }
  window.HistoryPlayer=HistoryPlayer;
})();
