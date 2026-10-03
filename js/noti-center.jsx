/* Centro de notificaciones estilo iOS · Spacio AM
   Capa de PRESENTACIÓN portada de la EPI App. Montado vía <x-import>.
   Exporta: NotiBell, NotiCenter, NotiToast. */
var React = window.React;
var useState = React.useState;

/* Icon: usa el set del design system (global del bundle) en tiempo de render. */
function Icon(props){
  var ns = window.SpacioAMDesignSystem_2c08fe;
  var I = ns && ns.Icon;
  if(!I) return null;
  var p = Object.assign({}, props);
  if(p.stroke && !p.color){ p.color = p.stroke; }
  delete p.stroke;
  return React.createElement(I, p);
}
var C = { peach: "#E9826A" };

/* Ventana de 7 días (incluye hoy). */
function notiSplit(notis){
  var lim=Date.now()-7*86400000;
  var rec=[], old=[];
  (notis||[]).forEach(function(n){ if(n.ts!=null && n.ts>=lim) rec.push(n); else old.push(n); });
  return {rec:rec, old:old};
}
function notiKey(n){ return n.id+"|"+(n.texto||"")+"|"+(n.ts!=null?n.ts:(n.cuando||"")); }
function notiHaceTxt(ms){
  var ahora=Date.now();
  var min=Math.round((ahora-ms)/60000);
  if(min<1) return "ahora";
  if(min<60) return min+"m";
  var d=new Date(ms);
  var dias=(ahora-ms)/86400000;
  if(dias<1) return ("0"+d.getHours()).slice(-2)+":"+("0"+d.getMinutes()).slice(-2);
  return d.toLocaleDateString("es-GT",{day:"numeric",month:"short"});
}
var NOTI_TIPOS=[["accion","Necesita tu acción","info"],["alerta","Alertas importantes","alert"]];

/* NotiBell — disparador: triángulo de atención + círculo del conteo.
   `color` y `badge` son opcionales: cada app puede pasar su par (EPI usa
   peach de atención + conteo ink). Sin props, el comportamiento no cambia. */
function NotiBell(props){
  var total = props.total, onOpen = props.onOpen;
  var col = props.color || "#3B6691";
  var badge = props.badge || "var(--accent,#E9826A)";
  if(!(total>0)) return null;
  return (
    <button onClick={function(e){e.stopPropagation();onOpen&&onOpen();}} title={total+" pendiente"+(total===1?"":"s")} aria-label={"Notificaciones ("+total+")"}
      style={{position:"relative",display:"inline-flex",alignItems:"center",justifyContent:"center",width:40,height:40,borderRadius:999,border:"none",background:"transparent",cursor:"pointer",flexShrink:0,padding:0}}>
      <Icon name="alert" size={23} stroke={col}/>
      <span style={{position:"absolute",top:-1,right:-1,minWidth:18,height:18,boxSizing:"border-box",padding:"0 5px",borderRadius:999,background:badge,color:"#fff",fontSize:10.5,fontWeight:700,fontVariantNumeric:"tabular-nums",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 1px 3px rgba(0,0,0,.28)"}}>{total>99?"99+":total}</span>
    </button>
  );
}

/* Fila con swipe: izquierda Eliminar, derecha Posponer. */
function NotiRow(props){
  var n=props.n, onOpen=props.onOpen, onDismiss=props.onDismiss, onSnooze=props.onSnooze;
  var W="rgba(255,255,255,";
  var cuando=n.cuando!=null?n.cuando:notiHaceTxt(n.ts);
  var setRef=React.useCallback(function(el){ if(el){ requestAnimationFrame(function(){ try{ el.scrollLeft=88; }catch(_){} }); } },[]);
  return (
    <div ref={setRef} data-noti-card className="noti-swipe" style={{display:"flex",overflowX:"auto",scrollSnapType:"x mandatory",scrollbarWidth:"none",msOverflowStyle:"none",borderRadius:22,gap:8,willChange:"transform,opacity"}}>
      <button onClick={function(){ onSnooze&&onSnooze(n); }} style={{flex:"0 0 80px",scrollSnapAlign:"start",border:"none",cursor:"pointer",borderRadius:22,background:"rgba(72,72,74,.55)",color:"#fff",fontSize:11,fontWeight:700,letterSpacing:".06em",textTransform:"uppercase",fontFamily:"Montserrat,sans-serif"}}>Posponer</button>
      <div onClick={onOpen} style={{flex:"0 0 100%",scrollSnapAlign:"center",boxSizing:"border-box",display:"flex",alignItems:"flex-start",gap:12,borderRadius:22,padding:"13px 17px",cursor:"pointer",background:"rgba(72,72,74,.42)",backdropFilter:"blur(40px) saturate(180%) brightness(1.08)",WebkitBackdropFilter:"blur(40px) saturate(180%) brightness(1.08)",border:"1px solid "+W+".14)",boxShadow:"0 8px 24px rgba(0,0,0,.18),inset 0 1px 0 "+W+".42),inset 0 0 0 1px "+W+".06)"}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:13.5,color:W+".98)",lineHeight:1.4,textWrap:"pretty"}}>{n.texto}</div>
          {n.contexto&&<div style={{fontSize:11.5,color:W+".68)",marginTop:3,lineHeight:1.45}}>{n.contexto}</div>}
        </div>
        <div style={{flexShrink:0,minWidth:34,textAlign:"right",fontSize:10.5,color:W+".6)",fontVariantNumeric:"tabular-nums"}}>{cuando}</div>
      </div>
      <button onClick={function(){ onDismiss&&onDismiss(n); }} style={{flex:"0 0 80px",scrollSnapAlign:"end",border:"none",cursor:"pointer",borderRadius:22,background:"rgba(192,57,43,.9)",color:"#fff",fontSize:11,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",fontFamily:"Montserrat,sans-serif"}}>Eliminar</button>
    </div>
  );
}

function NotiCenter(props){
  var open=props.open, onClose=props.onClose, notis=props.notis, onDismiss=props.onDismiss, onSnooze=props.onSnooze;
  var vm = useState(false); var verMas=vm[0], setVerMas=vm[1];
  var dy = useState(0); var dragY=dy[0], setDragY=dy[1];
  var cl = useState(false); var closing=cl[0], setClosing=cl[1];
  var startY = React.useRef(null);
  var dragRef = React.useRef(0);
  var scrollerRef = React.useRef(null);
  var draggingRef = React.useRef(false);
  React.useEffect(function(){
    if(!open) return;
    var b=document.body, prevO=b.style.overflow, prevT=b.style.touchAction;
    b.style.overflow="hidden"; b.style.touchAction="none";
    return function(){ b.style.overflow=prevO; b.style.touchAction=prevT; };
  },[open]);
  function tStart(e){
    startY.current = e.touches&&e.touches[0]?e.touches[0].clientY:null;
    dragRef.current=0; draggingRef.current=true;
  }
  function tMove(e){
    if(startY.current==null) return;
    var y=e.touches&&e.touches[0]?e.touches[0].clientY:null; if(y==null) return;
    var dyy=Math.min(0,y-startY.current);
    dragRef.current=dyy; setDragY(dyy);
  }
  function tEnd(){
    if(startY.current==null) return; startY.current=null; draggingRef.current=false;
    var wh=(typeof window!=="undefined"&&window.innerHeight)||1000;
    if(dragRef.current < -wh*0.35){ setClosing(true); setTimeout(function(){ setClosing(false); setDragY(0); dragRef.current=0; onClose&&onClose(); },340); }
    else { dragRef.current=0; setDragY(0); }
  }
  function onScroll(e){
    var el=e.currentTarget;
    var box=el.getBoundingClientRect();
    var top=box.top, bot=box.bottom;
    var cards=el.querySelectorAll("[data-noti-card]");
    cards.forEach(function(c){
      var r=c.getBoundingClientRect();
      var relTop=r.top-top;
      var relBot=bot-r.bottom;
      var scale=1, op=1, ty=0;
      if(relTop<40){
        var over=40-relTop;
        scale=Math.max(0.80,1-over/520);
        op=Math.max(0,1-over/86);
        ty=Math.min(over*0.35,44);
      } else if(relBot<28){
        var under=28-relBot;
        scale=Math.max(0.90,1-under/900);
        op=Math.max(0.35,1-under/150);
      }
      c.style.transformOrigin=relTop<40?"top center":"bottom center";
      c.style.transform="translateY("+ty+"px) scale("+scale+")";
      c.style.opacity=op;
    });
  }
  React.useEffect(function(){
    if(!open) return;
    var el=scrollerRef.current; if(!el) return;
    var raf=requestAnimationFrame(function(){ onScroll({currentTarget:el}); });
    return function(){ cancelAnimationFrame(raf); };
  },[open,dragY]);
  if(!open) return null;
  var sp=notiSplit(notis);
  var modoAntiguo = sp.rec.length===0 && sp.old.length>0;
  var mostrar = modoAntiguo ? sp.old : (verMas ? sp.rec.concat(sp.old) : sp.rec);
  var byTipo={};
  (mostrar||[]).forEach(function(n){ (byTipo[n.tipo]=byTipo[n.tipo]||[]).push(n); });
  var grupos=NOTI_TIPOS.filter(function(t){ return byTipo[t[0]]&&byTipo[t[0]].length; }).map(function(t){
    var items=byTipo[t[0]], orden=[], mapa={};
    items.forEach(function(n){ var sub=n.subcat||"General"; if(!mapa[sub]){mapa[sub]=[];orden.push(sub);} mapa[sub].push(n); });
    return {key:t[0], titulo:t[1], icon:t[2], count:items.length, subs:orden.map(function(sub){ return {label:sub, items:mapa[sub]}; })};
  });
  var vacio=grupos.length===0;
  var W="rgba(255,255,255,";
  var d = dragY<0?dragY:0;
  var revelado = !!(d||closing);
  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,zIndex:200,overflow:"hidden",background:"rgba(28,28,30,"+(closing?0:.34)+")",backdropFilter:"blur(30px) saturate(180%) brightness(1.06)",WebkitBackdropFilter:"blur(30px) saturate(180%) brightness(1.06)",transform:closing?"translateY(-100%)":(d?"translateY("+d+"px)":"none"),opacity:closing?0:1,borderBottomLeftRadius:revelado?26:0,borderBottomRightRadius:revelado?26:0,transition:draggingRef.current?"none":"transform .34s cubic-bezier(0.22,0.61,0.36,1),background .32s cubic-bezier(0.22,0.61,0.36,1),opacity .32s cubic-bezier(0.22,0.61,0.36,1),border-radius .32s cubic-bezier(0.22,0.61,0.36,1)"}}>
      <div onClick={function(e){e.stopPropagation();}}
        style={{position:"absolute",top:56,bottom:78,left:"50%",width:"100%",maxWidth:420,transform:"translateX(-50%)",display:"flex",flexDirection:"column"}}>
        <div ref={scrollerRef} onScroll={onScroll} className="noti-swipe" style={{flex:1,minHeight:0,overflowY:"auto",WebkitOverflowScrolling:"touch",scrollbarWidth:"none",msOverflowStyle:"none",display:"flex",flexDirection:"column",gap:14,padding:"0 14px"}}>
        {(vacio||modoAntiguo)&&(
          <div style={{textAlign:"center",fontSize:10,fontWeight:600,letterSpacing:".16em",textTransform:"uppercase",color:W+".72)"}}>
            {vacio?"Sin notificaciones. Todo al día."
              :"Nada nuevo en 7 días · "+sp.old.length+" pendiente"+(sp.old.length===1?"":"s")+" de antes"}
          </div>
        )}
        {!modoAntiguo&&sp.old.length>0&&!verMas&&(
          <div style={{textAlign:"center",fontSize:10.5,color:W+".5)",fontWeight:500}}>Mostrando los últimos 7 días.</div>
        )}
        {grupos.map(function(g){
          return (
            <div key={g.key} style={{display:"flex",flexDirection:"column",gap:10}}>
              <div style={{display:"flex",alignItems:"center",gap:9,padding:"2px 6px"}}>
                <Icon name={g.icon} size={17} stroke={W+".92)"}/>
                <span style={{flex:1,fontSize:11.5,fontWeight:600,letterSpacing:".16em",textTransform:"uppercase",color:W+".92)"}}>{g.titulo}</span>
                <span style={{fontSize:12,fontWeight:600,fontVariantNumeric:"tabular-nums",color:W+".6)"}}>{g.count}</span>
              </div>
              {g.subs.map(function(sub){
                var MAX=4;
                var ord=sub.items.slice().sort(function(a,b){
                  var pa=a.peso!=null?a.peso:(a.ts?(Date.now()-a.ts):0);
                  var pb=b.peso!=null?b.peso:(b.ts?(Date.now()-b.ts):0);
                  return pb-pa;
                });
                var top=ord.slice(0,MAX), resto=ord.slice(MAX);
                return (
                  <div key={sub.label} style={{display:"flex",flexDirection:"column",gap:8}}>
                    <div style={{padding:"0 6px",fontSize:9.5,fontWeight:600,letterSpacing:".16em",textTransform:"uppercase",color:W+".5)"}}>{sub.label}{sub.items.length>MAX?" · "+sub.items.length:""}</div>
                    {top.map(function(n){
                      return (
                        <NotiRow key={n.id} n={n}
                          onOpen={function(){ onClose&&onClose(); n.abrir&&n.abrir(); }}
                          onDismiss={onDismiss} onSnooze={onSnooze}/>
                      );
                    })}
                    {resto.length>0&&(
                      <div onClick={function(){ onClose&&onClose(); resto[0].abrir&&resto[0].abrir(); }} style={{cursor:"pointer",borderRadius:22,padding:"12px 17px",background:"rgba(72,72,74,.30)",backdropFilter:"blur(30px) saturate(170%) brightness(1.06)",WebkitBackdropFilter:"blur(30px) saturate(170%) brightness(1.06)",border:"1px solid "+W+".10)",boxShadow:"inset 0 1px 0 "+W+".24)",display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
                        <span style={{fontSize:12.5,color:W+".82)"}}>y {resto.length} más en la lista</span>
                        <Icon name="chevronRight" size={16} stroke={W+".6)"}/>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
        {!modoAntiguo&&sp.old.length>0&&(
          <button onClick={function(){ setVerMas(!verMas); }} style={{alignSelf:"center",marginTop:2,marginBottom:8,border:"1px solid "+W+".2)",cursor:"pointer",borderRadius:999,padding:"9px 20px",background:"rgba(72,72,74,.35)",backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",color:W+".92)",fontSize:11,fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",fontFamily:"Montserrat,sans-serif"}}>{verMas?"Ver menos":"Ver más · "+sp.old.length+" anteriores"}</button>
        )}
        </div>
      </div>
      <div onTouchStart={tStart} onTouchMove={tMove} onTouchEnd={tEnd} onClick={onClose}
        style={{position:"absolute",left:0,right:0,bottom:0,height:78,touchAction:"none",cursor:"grab",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:9,paddingBottom:"env(safe-area-inset-bottom)",userSelect:"none",WebkitUserSelect:"none"}}>
        <div style={{width:44,height:5,borderRadius:999,background:W+".55)"}}></div>
        <span style={{fontSize:9,fontWeight:600,letterSpacing:".18em",textTransform:"uppercase",color:W+".5)"}}>Desliza para cerrar</span>
      </div>
    </div>
  );
}

/* useNotiPush — cableado oficial del push. Marca "visto" SÍNCRONO + tope de 2
   por sesión; las que sobran quedan pendientes para el próximo login. */
function useNotiPush(notisVis, storeKey){
  var KEY = storeKey || "epi:notiSeen";
  var ts = useState([]); var toasts = ts[0], setToasts = ts[1];
  var seenRef = React.useRef(null);
  function _load(){ try{ return JSON.parse(localStorage.getItem(KEY)||"null"); }catch(_){ return null; } }
  function _save(o){ try{ localStorage.setItem(KEY, JSON.stringify(o)); }catch(_){} }
  var visSig = (notisVis||[]).map(notiKey).join("|");
  React.useEffect(function(){
    var list = notisVis||[];
    if(seenRef.current==null) seenRef.current=_load();
    var keys = list.map(notiKey);
    if(seenRef.current==null){ var boot={}; keys.forEach(function(k){ boot[k]=1; }); seenRef.current=boot; _save(boot); return; }
    var nuevos = list.filter(function(n){ return n.ts!=null && !seenRef.current[notiKey(n)]; });
    var toShow = nuevos.slice(0,2);
    if(!toShow.length) return;
    var u = Object.assign({}, seenRef.current);
    toShow.forEach(function(n){ u[notiKey(n)]=1; });
    seenRef.current=u; _save(u);
    setToasts(function(p){ return p.concat(toShow).slice(-2); });
  },[visSig]);
  function close(item){ var k=notiKey(item); setToasts(function(p){ return p.filter(function(t){ return notiKey(t)!==k; }); }); }
  return { toasts: toasts, close: close };
}

/* Banner push · versión del Dashboard de Propietarios (mi-spacioam/noti-center.jsx):
   vidrio claro con textura esmerilada, sparkle en chip peach y texto en ink.
   Baja desde arriba, se queda ~5s y se va sola. */
function NotiToast(props) {
  var item = props.item, onOpen = props.onOpen, onClose = props.onClose;
  var st = useState(false); var show = st[0], setShow = st[1];
  var d = useState(0); var dy = d[0], setDy = d[1];
  var startY = React.useRef(null), dragging = React.useRef(false);
  React.useEffect(function () {
    var a = requestAnimationFrame(function () { setShow(true); });
    var t = setTimeout(function () { setShow(false); setTimeout(onClose, 340); }, 5000);
    return function () { cancelAnimationFrame(a); clearTimeout(t); };
  }, []);
  if (!item) return null;
  function tStart(e) { startY.current = e.touches && e.touches[0] ? e.touches[0].clientY : null; dragging.current = true; }
  function tMove(e) { if (startY.current == null) return; var y = e.touches && e.touches[0] ? e.touches[0].clientY : null; if (y == null) return; setDy(Math.min(0, y - startY.current)); }
  function tEnd() { if (startY.current == null) return; var v = dy; startY.current = null; dragging.current = false; if (v < -36) { setShow(false); setDy(0); setTimeout(onClose, 300); } else { setDy(0); } }
  var GLASS = "data:image/svg+xml;utf8," + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter><rect width="100%" height="100%" filter="url(#n)" opacity="0.55"/></svg>');
  var node = (
    <div onClick={function () { if (dy) return; onOpen && onOpen(); setShow(false); setTimeout(onClose, 200); }}
      onTouchStart={tStart} onTouchMove={tMove} onTouchEnd={tEnd}
      style={{ position: "fixed", top: "max(12px,env(safe-area-inset-top))", left: "50%", width: "calc(100% - 24px)", maxWidth: 400, zIndex: 400, cursor: "pointer", touchAction: "pan-x", borderRadius: 22, overflow: "hidden", isolation: "isolate", background: "linear-gradient(135deg,rgba(255,255,255,.18),rgba(248,247,245,.08))", backdropFilter: "blur(14px) saturate(210%)", WebkitBackdropFilter: "blur(14px) saturate(210%)", border: "1px solid rgba(255,255,255,.45)", boxShadow: "0 22px 55px rgba(62,63,63,.22),inset 0 1px 0 rgba(255,255,255,.7),inset 0 0 0 1px rgba(255,255,255,.15)", willChange: "transform", transform: "translateX(-50%) translateY(" + (show ? dy + "px" : "-150%") + ")", opacity: show ? 1 : 0, transition: dragging.current ? "opacity .3s" : "transform .4s cubic-bezier(0.22,0.61,0.36,1),opacity .3s cubic-bezier(0.22,0.61,0.36,1)" }}>
      {/* textura de vidrio esmerilado — no depende de backdrop-filter */}
      <div style={{ position: "absolute", inset: 0, backgroundImage: "url(\"" + GLASS + "\")", backgroundSize: "160px 160px", opacity: 0.12, mixBlendMode: "soft-light", pointerEvents: "none" }} />
      {/* brillo especular superior */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "55%", background: "linear-gradient(180deg,rgba(255,255,255,.22),rgba(255,255,255,0))", pointerEvents: "none" }} />
      <div style={{ position: "relative", display: "flex", alignItems: "flex-start", gap: 12, padding: "13px 16px" }}>
        <div style={{ flexShrink: 0, width: 38, height: 38, borderRadius: 11, background: "linear-gradient(150deg,#F2926F,#E9826A 55%,#DE6F55)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px rgba(233,130,106,.35),inset 0 1px 0 rgba(255,255,255,.5),inset 0 -1px 2px rgba(140,60,45,.3)" }}>{(function () { var ns = window.SpacioAMDesignSystem_2c08fe; if (ns && ns.Sparkle) return React.createElement(ns.Sparkle, { size: 20, color: "#fff" }); return null; })()}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".16em", textTransform: "uppercase", color: "var(--fg-muted,#6F6867)", marginBottom: 2 }}>Spacio AM · ahora</div>
          <div style={{ fontSize: 13.5, color: "var(--ink,#3E3F3F)", lineHeight: 1.35, textWrap: "pretty", fontWeight: 600 }}>{item.texto}</div>
          {item.contexto && <div style={{ fontSize: 11.5, color: "var(--fg-muted,#6F6867)", marginTop: 2, lineHeight: 1.4 }}>{item.contexto}</div>}
        </div>
      </div>
    </div>
  );
  return (window.ReactDOM && window.ReactDOM.createPortal) ? window.ReactDOM.createPortal(node, document.body) : node;
}

/* NotiPush — wrapper con el retardo de 10s del Dashboard: el primer banner
   no interrumpe apenas carga la pantalla. */
function NotiPush(props) {
  var notis = props.notis || [];
  var onOpen = props.onOpen;
  var rd = useState(false); var ready = rd[0], setReady = rd[1];
  React.useEffect(function () {
    var t = setTimeout(function () { setReady(true); }, 10000);
    return function () { clearTimeout(t); };
  }, []);
  var push = useNotiPush(ready ? notis : [], props.storeKey);
  var item = push.toasts[0];
  if (!ready || !item) return null;
  return React.createElement(NotiToast, { key: notiKey(item), item: item,
    onOpen: function () { onOpen && onOpen(); push.close(item); },
    onClose: function () { push.close(item); } });
}

module.exports = { NotiBell: NotiBell, NotiCenter: NotiCenter, NotiToast: NotiToast, NotiPush: NotiPush };
