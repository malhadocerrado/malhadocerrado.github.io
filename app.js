(function(){
'use strict';
var H=3600, D=86400, D3=3*D, D30=30*D;
var todos=[], meta={}, mcDisp=false, lac=null, nov=null, zap=null;
function $(id){return document.getElementById(id);}
function el(t,txt,cls){var e=document.createElement(t);if(txt!=null)e.textContent=txt;if(cls)e.className=cls;return e;}
function agora(){return Math.floor(Date.now()/1000);}
function idade(v){if(!v)return null;return agora()-v;}
function rel(v){var s=idade(v);if(s==null)return 'sem data';if(s<0)s=0;
  if(s<90)return 'agora há pouco';if(s<5400)return 'há '+Math.round(s/60)+' min';
  if(s<2*D)return 'há '+Math.round(s/H)+' h';
  var d=Math.round(s/D);return 'há '+d+' dia'+(d===1?'':'s');}
function faixa(n){var s=idade(n.v);if(s==null)return 'sem';if(s<=D)return 'ativo';if(s<=D3)return 'recente';if(s<=D30)return 'inativo';return 'fora';}
function noMapa(n){return faixa(n)!=='fora';}
var COR={ativo:'#16a34a',recente:'#f59e0b',inativo:'#dc2626',sem:'#9ca3af'};
var ROTULO={ativo:'Ativo',recente:'Sem contato recente',inativo:'Inativo',sem:'Sem data',fora:'Inativo há mais de 30 dias'};
function rede(n){return n.t==='meshcore'?'MeshCore':'Meshtastic';}
function dh(ep){if(!ep)return '';var d=new Date(ep*1000);
  return d.toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})+' (Brasília)';}
function horaBR(ep){
  var g={};new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(new Date(ep*1000)).forEach(function(p){g[p.type]=p.value;});
  return g.day+'/'+g.month+' '+g.hour+':'+g.minute;}
function textoUltima(v){if(!v)return 'Última resposta: sem data';return 'Última resposta: '+horaBR(v)+' ('+rel(v)+')';}
function dd(ep){if(!ep)return '';return new Date(ep*1000).toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit'});}
function local(n){return [n.m,n.uf].filter(Boolean).join(' - ');}
var RAIO_ALCANCE_M=3000; // estimativa única e conservadora (sem dado de altura da antena)
function km(a,b,c,d){var p=Math.PI/180,x=Math.sin((c-a)*p/2)**2+Math.cos(a*p)*Math.cos(c*p)*Math.sin((d-b)*p/2)**2;return 12742*Math.asin(Math.sqrt(x));}
function direcao(a,b,c,d){var y=Math.sin((d-b)*Math.PI/180)*Math.cos(c*Math.PI/180);
  var x=Math.cos(a*Math.PI/180)*Math.sin(c*Math.PI/180)-Math.sin(a*Math.PI/180)*Math.cos(c*Math.PI/180)*Math.cos((d-b)*Math.PI/180);
  var nomes=['norte','nordeste','leste','sudeste','sul','sudoeste','oeste','noroeste'];
  return nomes[Math.round(((Math.atan2(y,x)*180/Math.PI)+360)%360/45)%8];}
function fmtKm(v){if(v<1)return v<0.15?'bem perto':(Math.round(v*10)/10).toString().replace('.',',')+' km';return Math.round(v)+' km';}
function nz(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();}
function bandas(lst){var r={tot:lst.length,ativo:0,recente:0,inativo:0,sem:0,fora:0,mapa:0};
  lst.forEach(function(n){r[faixa(n)]++;});r.mapa=r.ativo+r.recente+r.inativo+r.sem;return r;}

// círculos = Meshtastic; quadrados = MeshCore (cor é o status)
if(L.Canvas){var _upd=L.Canvas.prototype._updateCircle;
  L.Canvas.prototype._updateCircle=function(layer){
    if(layer.options.shape!=='square')return _upd.call(this,layer);
    if(!this._drawing||layer._empty())return;
    var p=layer._point,r=Math.max(Math.round(layer._radius),1),ctx=this._ctx;
    this._drawnLayers[layer._leaflet_id]=layer;
    ctx.beginPath();ctx.rect(p.x-r,p.y-r,2*r,2*r);this._fillStroke(ctx,layer);};}

// abas (cada aba tem um endereço: #inicio, #mapa, #novidades, #lacunas, #cidades, #online, #comece, #sobre, #comunidade, #contato)
var ALIAS={guia:'comece',estados:'cidades',sugestoes:'contato'};
var abas=document.querySelectorAll('.abas button');
function abre(nome){nome=ALIAS[nome]||nome;if(!$('aba-'+nome))nome='inicio';
  abas.forEach(function(b){b.classList.toggle('ativa',b.dataset.aba===nome);});
  document.querySelectorAll('.aba').forEach(function(s){s.classList.toggle('ativa',s.id==='aba-'+nome);});
  if(nome==='mapa')setTimeout(function(){mapa.invalidateSize();},50);
  if(nome==='lacunas'){iniciaMapaLac();setTimeout(function(){if(mapaLac)mapaLac.invalidateSize();},50);}
  if(history.replaceState)history.replaceState(null,'','#'+nome);
  window.scrollTo(0,0);}
abas.forEach(function(b){b.addEventListener('click',function(){abre(b.dataset.aba);});});
document.addEventListener('click',function(ev){var a=ev.target.closest&&ev.target.closest('[data-vai]');if(a){ev.preventDefault();abre(a.dataset.vai);}});

// mapa principal: uma camada por rede, com liga/desliga
var mapa=L.map('mapa-principal',{preferCanvas:true}).setView([-14.5,-52],4);
mapa.getContainer()._leafletMap=mapa;
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:17,attribution:'© OpenStreetMap'}).addTo(mapa);
var camadas={meshtastic:L.layerGroup().addTo(mapa),meshcore:L.layerGroup().addTo(mapa)};
var camadaAlcance=L.layerGroup().addTo(mapa),camadaEu=L.layerGroup().addTo(mapa),renderAlcance=null;
var euLat=null,euLon=null;

function iniciaLegenda(){
  var btn=$('btn-legenda'), painel=$('painel-legenda'), fecha=painel&&painel.querySelector('.btn-fecha-legenda');
  if(!btn||!painel)return;
  function setAberto(on){
    painel.hidden=!on;
    btn.setAttribute('aria-expanded',on?'true':'false');
    btn.classList.toggle('aberta',on);
  }
  setAberto(window.matchMedia('(min-width:768px)').matches);
  btn.addEventListener('click',function(){setAberto(painel.hidden);});
  if(fecha) fecha.addEventListener('click',function(){setAberto(false);});
  L.DomEvent.disableClickPropagation(painel);
  L.DomEvent.disableScrollPropagation(painel);
  L.DomEvent.disableClickPropagation(btn);
}
iniciaLegenda();

function popup(n){var d=el('div');d.appendChild(el('strong',n.n));
  function lin(r,v){if(v){d.appendChild(el('br'));d.appendChild(document.createTextNode(r?r+': '+v:v));}}
  var f=faixa(n);
  lin('Rede',rede(n)+' · '+(f==='inativo'?'Inativo '+(n.v?rel(n.v):''):ROTULO[f]).trim());
  lin('Local',local(n));
  d.appendChild(el('br'));d.appendChild(document.createTextNode(textoUltima(n.v)));
  lin('Placa',n.hw);lin('Papel',n.f);lin('Região',n.r);if(n.fr)lin('Frequência',String(n.fr).replace('.',',')+' MHz');lin('Preset',n.p);lin('Firmware',n.fw);
  if(n.c)lin('Nome curto',n.c);
  return d;}

function marcador(n,r){
  var f=faixa(n),mc=n.t==='meshcore';
  var m=L.circleMarker([n.la,n.lo],{radius:r!=null?r:(f==='ativo'?8:(f==='recente'?6:5)),
    shape:mc?'square':'circle',color:'#fff',weight:1,fillColor:COR[f]||'#9ca3af',fillOpacity:.92});
  m.bindPopup(function(){return popup(n);});
  return m;}

function redeOn(t){return $(t==='meshcore'?'c-mc':'c-mt').checked;}
function filtrados(){
  var uf=$('f-uf').value,so=$('f-ativos').checked,q=nz($('f-busca').value.trim());
  return todos.filter(function(n){
    if(!noMapa(n))return false;
    if(!redeOn(n.t))return false;
    if(uf&&n.uf!==uf)return false;
    if(so&&faixa(n)!=='ativo')return false;
    if(q&&nz(n.n+' '+n.m+' '+n.i+' '+n.c).indexOf(q)<0)return false;
    return true;});}

function desenha(){camadas.meshtastic.clearLayers();camadas.meshcore.clearLayers();var lst=filtrados();
  lst.forEach(function(n){marcador(n).addTo(camadas[n.t]);});
  $('f-busca').title=lst.length+' nós no mapa';
  cartoes();inativos();desenhaAlcance();if(euLat!=null)atualizaPerto();}
function filtrosRede(){desenha();}

function card(c,v,t){var x=el('div',null,'cartao');x.appendChild(el('b',String(v)));x.appendChild(el('span',t));c.appendChild(x);}

function cartoes(){var c=$('cartoes');c.textContent='';
  var base=todos.filter(function(n){return noMapa(n)&&redeOn(n.t)&&(!$('f-uf').value||n.uf===$('f-uf').value);});
  var lst=filtrados();var a=bandas(lst),b=bandas(base);
  var mt=lst.filter(function(n){return n.t==='meshtastic';}).length;
  card(c,a.ativo,'ativos (24 h) na seleção');
  if(!$('f-ativos').checked){card(c,a.recente,'sem contato recente');card(c,a.inativo,'inativos no mapa (3–30 dias)');}
  card(c,b.mapa,'nós no mapa (até 30 dias)');
  if(b.sem)card(c,b.sem,'sem data');
  card(c,mt,'Meshtastic na seleção');card(c,mcDisp?(lst.length-mt):'em breve','MeshCore na seleção');}

function inicio(){var c=$('cartoes-inicio');c.textContent='';
  var br=bandas(todos),go=todos.filter(function(n){return n.uf==='GO';}),g=bandas(go);
  var ufs={};todos.filter(noMapa).forEach(function(n){if(n.uf)ufs[n.uf]=1;});
  var cgo={};go.filter(noMapa).forEach(function(n){if(n.m)cgo[n.m]=1;});
  card(c,br.ativo,'ativos no Brasil (24 h)');
  card(c,br.mapa,'no mapa (até 30 dias)');
  card(c,br.fora,'inativos (>30 dias)');
  if(br.sem)card(c,br.sem,'sem data');
  card(c,g.ativo,'ativos em Goiás (24 h)');
  card(c,g.mapa,'Goiás no mapa (até 30 dias)');
  var p=$('goias-resumo');
  var t='Em Goiás, '+g.ativo+' nós ativos (ouvidos nas últimas 24 h) de '+g.mapa+' no mapa (até 30 dias: '+g.ativo+' ativos, '+g.recente+' sem contato recente, '+g.inativo+' inativos). ';
  t+='Há também '+g.fora+' inativos há mais de 30 dias (só na lista, fora do mapa)'+(g.sem?(' e '+g.sem+' sem data'):'')+'. ';
  t+='No Brasil: '+br.ativo+' ativos, '+br.recente+' sem contato recente, '+br.inativo+' inativos no mapa, '+br.fora+' inativos há mais de 30 dias'+(br.sem?(' e '+br.sem+' sem data'):'')+'. ';
  if(lac&&lac.cidades){var longe=lac.cidades.filter(function(x){return x.d>lac.lim_medio;}).length;
    t+='Das lacunas: dos '+lac.cidades.length+' municípios goianos, '+longe+' ficam a mais de '+lac.lim_medio+' km de qualquer nó com resposta nos últimos 30 dias (estimativa simples em linha reta). ';}
  var mt=todos.filter(function(n){return n.t==='meshtastic';}).length;
  t+='Total coletado: '+mt+' Meshtastic e '+(todos.length-mt)+' MeshCore. Dados de '+dh(meta.mt)+'.';
  p.textContent=t;}

function ufs(){var s={};todos.forEach(function(n){if(n.uf)s[n.uf]=1;});return Object.keys(s).sort();}
function preencheUF(sel){ufs().forEach(function(u){var o=el('option',u);o.value=u;sel.appendChild(o);});}

function tabela(alvo,cols,linhas,vazio){var w=$(alvo);w.textContent='';
  if(!linhas.length){w.appendChild(el('p',vazio||'Nada para mostrar por enquanto.','nota'));return;}
  var wrap=el('div',null,'tabela-wrap'),t=el('table'),th=el('thead'),tr=el('tr');
  cols.forEach(function(c){var x=el('th',c.t);if(c.num)x.className='num';tr.appendChild(x);});th.appendChild(tr);t.appendChild(th);
  var tb=el('tbody');linhas.forEach(function(l){var r=el('tr');if(l._cls)r.className=l._cls;if(l._click){r.className=(r.className?r.className+' ':'')+'clic';r.addEventListener('click',l._click);}
    cols.forEach(function(c){var v=c.f(l);var x=el('td',v==null||v===''?'-':String(v));if(c.num)x.className='num';r.appendChild(x);});tb.appendChild(r);});
  t.appendChild(tb);wrap.appendChild(t);w.appendChild(wrap);}

function inativos(){
  var uf=$('f-uf').value,q=nz($('f-busca').value.trim());
  var lst=todos.filter(function(n){if(faixa(n)!=='fora')return false;if(!redeOn(n.t))return false;if(uf&&n.uf!==uf)return false;if(q&&nz(n.n+' '+n.m+' '+n.i+' '+n.c).indexOf(q)<0)return false;return true;})
    .sort(function(a,b){return (a.uf==='GO'?0:1)-(b.uf==='GO'?0:1)||(b.v||0)-(a.v||0);});
  var go=lst.filter(function(n){return n.uf==='GO';}).length;
  $('inativos-resumo').textContent=lst.length+' nós nesta lista'+(go?(' (deles, '+go+' em Goiás)'):'')+(lst.length>300?' — mostrando os 300 com resposta mais recente; use a busca.':'.')+' Goiás aparece primeiro.';
  tabela('lista-inativos',[{t:'Nome',f:function(n){return n.n;}},{t:'Rede',f:rede},{t:'Local',f:local},{t:'Última resposta',f:function(n){return n.v?horaBR(n.v)+' ('+rel(n.v)+')':'sem data';}}],
    lst.slice(0,300).map(function(n){n._cls='';return n;}),'Nenhum nó inativo há mais de 30 dias com estes filtros.');}

// quem está online
function online(){var tb=document.querySelector('#tab-online tbody');tb.textContent='';
  var jan=$('o-janela').value,lim=jan==='1h'?H:(jan==='72h'?D3:D),uf=$('o-uf').value,rd=$('o-rede').value;
  var lst=todos.filter(function(n){var s=idade(n.v);return s!=null&&s<=lim&&(!uf||n.uf===uf)&&(rd==='todas'||n.t===rd);}).sort(function(a,b){return b.v-a.v;});
  lst.slice(0,500).forEach(function(n){var tr=el('tr');
    [n.n,rede(n),local(n),n.hw,n.f,textoUltima(n.v).replace('Última resposta: ','')].forEach(function(v){tr.appendChild(el('td',v||'-'));});
    tb.appendChild(tr);});
  $('o-resumo').textContent=lst.length+' nós'+(lst.length>500?' (mostrando os 500 mais recentes)':'')+'.';}

// cidades (ficha por cidade) e estados
function cidades(){var tb=document.querySelector('#tab-cidades tbody');tb.textContent='';
  var rd=$('ci-rede').value,uf=$('ci-uf').value,q=nz($('ci-busca').value.trim());var m={};
  todos.forEach(function(n){if(!n.m||!n.uf)return;if(rd!=='todas'&&n.t!==rd)return;if(uf&&n.uf!==uf)return;if(q&&nz(n.m).indexOf(q)<0)return;
    var k=n.uf+'|'+n.m,f=faixa(n);
    var x=m[k]||(m[k]={m:n.m,uf:n.uf,tot:0,mapa:0,ativo:0,fora:0,mtA:0,mcA:0});
    x.tot++;if(f!=='fora')x.mapa++;if(f==='ativo'){x.ativo++;if(n.t==='meshcore')x.mcA++;else x.mtA++;}if(f==='fora')x.fora++;});
  var l=Object.keys(m).map(function(k){return m[k];}).sort(function(a,b){return b.ativo-a.ativo||b.mapa-a.mapa||b.tot-a.tot||a.m.localeCompare(b.m);});
  $('ci-resumo').textContent=l.length+' cidades com nós'+(l.length>300?' (mostrando as 300 primeiras; use a busca)':'')+'. “Ativos (24 h)” conta só quem foi ouvido nas últimas 24 horas.';
  l.slice(0,300).forEach(function(x){var tr=el('tr',null,'clic');
    [x.m,x.uf,x.ativo,x.mapa,x.fora,x.mtA,mcDisp?x.mcA:'-'].forEach(function(v,i){var td=el('td',String(v));if(i>1)td.className='num';tr.appendChild(td);});
    tr.addEventListener('click',function(){ficha(x.m,x.uf);});tb.appendChild(tr);});}

function ficha(cid,uf){var f=$('ficha');f.textContent='';f.hidden=false;
  var ns=todos.filter(function(n){return n.m===cid&&n.uf===uf;}).sort(function(a,b){return (b.v||0)-(a.v||0);});
  var no=ns.filter(noMapa);
  f.appendChild(el('h3','Ficha de '+cid+' - '+uf));
  var c=el('div',null,'cartoes');
  ['meshtastic','meshcore'].forEach(function(t){var l=ns.filter(function(n){return n.t===t;});var a=bandas(l);
    card(c,a.ativo,(t==='meshcore'?'MeshCore':'Meshtastic')+': ativos (24 h)');
    card(c,a.mapa,'no mapa (até 30 dias)');
    if(a.fora)card(c,a.fora,'inativos (>30 dias)');});
  f.appendChild(c);
  if(lac&&uf==='GO'){var x=lac.cidades.filter(function(y){return y.c===cid;})[0];
    if(x)f.appendChild(el('p','Nó com resposta nos últimos 30 dias mais próximo (estimativa em linha reta): '+(x.d)+' km'+(x.d>0?' ('+x.nm+(x.nu?' - '+x.nu:'')+')':'')+'.','nota'));}
  var ul=el('ul');ns.slice(0,30).forEach(function(n){ul.appendChild(el('li',n.n+' · '+rede(n)+' · '+ROTULO[faixa(n)]+' · '+textoUltima(n.v)));});f.appendChild(ul);
  if(no.length){var b=el('button','Ver no mapa','botao');b.type='button';b.addEventListener('click',function(){$('f-uf').value=uf;$('f-busca').value=cid;$('f-ativos').checked=false;desenha();abre('mapa');mapa.fitBounds(no.map(function(n){return [n.la,n.lo];}),{maxZoom:12,padding:[30,30]});});
    f.appendChild(b);}
  f.scrollIntoView({behavior:'smooth',block:'nearest'});}

function estados(){var tb=document.querySelector('#tab-estados tbody');tb.textContent='';
  var m={};todos.forEach(function(n){var u=n.uf||'?';var x=m[u]||(m[u]={uf:u,tot:0,mapa:0,ativo:0,fora:0,mt:0,mc:0});
    var f=faixa(n);x.tot++;if(f!=='fora'){x.mapa++;if(n.t==='meshcore')x.mc++;else x.mt++;}if(f==='ativo')x.ativo++;if(f==='fora')x.fora++;});
  Object.keys(m).map(function(k){return m[k];}).sort(function(a,b){return b.ativo-a.ativo||b.mapa-a.mapa;}).forEach(function(x){
    var tr=el('tr',null,'clic');
    [x.uf==='?'?'sem UF':x.uf,x.ativo,x.mapa,x.fora,x.mt,mcDisp?x.mc:'-'].forEach(function(v,i){var td=el('td',String(v));if(i>0)td.className='num';tr.appendChild(td);});
    tr.addEventListener('click',function(){if(x.uf!=='?'){$('f-uf').value=x.uf;$('f-busca').value='';$('f-ativos').checked=false;desenha();abre('mapa');
      var p=todos.filter(function(n){return n.uf===x.uf&&noMapa(n);}).map(function(n){return [n.la,n.lo];});if(p.length)mapa.fitBounds(p,{maxZoom:9,padding:[20,20]});}});
    tb.appendChild(tr);});}

// textos de apoio do guia (dados reais)
function regioes(){var c={};todos.filter(function(n){return n.t==='meshtastic'&&n.r;}).forEach(function(n){c[n.r]=(c[n.r]||0)+1;});
  var ks=Object.keys(c).sort(function(a,b){return c[b]-c[a];});
  $('regiao-dados').textContent=ks.length?'Só para informação, sem recomendação: no mapa, os nós Meshtastic que informam a região aparecem assim: '+ks.map(function(k){return k+' ('+c[k]+')';}).join(', ')+'. Muitos nós não informam a região.':'';}
function freqmc(){var c={},t=0;todos.filter(function(n){return n.t==='meshcore'&&n.fr;}).forEach(function(n){c[n.fr]=(c[n.fr]||0)+1;t++;});
  var p=$('mc-dados');if(!t){p.textContent='';return;}
  var k=Object.keys(c).sort(function(a,b){return c[b]-c[a];}).slice(0,3).map(function(f){return c[f]+' em '+String(f).replace('.',',')+' MHz';});
  p.textContent='No mapa MeshCore ('+t+' nós com frequência informada): '+k.join('; ')+'. Combine os parâmetros com a comunidade local antes de ligar.';}
function compara(){var mt=todos.filter(function(n){return n.t==='meshtastic';}).length,mc=todos.length-mt;
  var go=todos.filter(function(n){return n.uf==='GO';}),gm=go.filter(function(n){return n.t==='meshtastic';}).length;
  var b=bandas(todos),g=bandas(go);
  $('comp-dados').textContent='No mapa hoje (até 30 dias): '+b.mapa+' nós no Brasil ('+b.ativo+' ativos nas últimas 24 h) e '+g.mapa+' em Goiás ('+g.ativo+' ativos). No total coletado: '+mt+' Meshtastic e '+mc+' MeshCore.';
  var h={};todos.forEach(function(n){var x=(n.hw||'').trim();if(x&&x!=='UNSET')h[x]=(h[x]||0)+1;});
  var ks=Object.keys(h).sort(function(a,b){return h[b]-h[a];}).slice(0,6);
  $('hw-dados').textContent=ks.length?'Para ter uma ideia do que a comunidade usa, estas são as placas que mais aparecem: '+ks.map(function(k){return k+' ('+h[k]+')';}).join(', ')+'. Não é recomendação de compra.':'';}

// novidades da semana (gerado pelo servidor)
function novidades(){if(!nov){$('nov-info').textContent='Não consegui carregar as novidades agora.';return;}
  var i=$('nov-info');
  i.textContent=nov.primeira_execucao||!nov.novos_total&&nov.inicio&&agora()-nov.inicio<D?'O acompanhamento de novidades começou em '+dh(nov.inicio)+'. Nós e cidades novos passam a aparecer a partir daí; antes disso não temos como saber quando entraram. Atualizado em '+dh(nov.atualizado)+'.':'O acompanhamento começou em '+dh(nov.inicio)+'. Atualizado em '+dh(nov.atualizado)+'.';
  var c=$('nov-cartoes');c.textContent='';card(c,nov.novos_total,'nós novos (7 dias)');card(c,(nov.cidades_novas||[]).length,'cidades novas');card(c,nov.quedas_total,'em silêncio (48 h a 7 dias)');card(c,nov.quedas_go,'em silêncio em Goiás');
  var cn=[{t:'Nome',f:function(n){return n.n;}},{t:'Rede',f:function(n){return rede(n);}},{t:'Local',f:local},{t:'Visto pela 1ª vez',f:function(n){return dd(n.pv);}}];
  tabela('nov-novos',cn,nov.novos||[],'Nenhum nó novo registrado ainda desde o início do acompanhamento.');
  tabela('nov-cidades',[{t:'Cidade',f:function(x){return x.m;}},{t:'UF',f:function(x){return x.uf;}},{t:'Primeiro nó visto em',f:function(x){return dd(x.pv);}}],nov.cidades_novas||[],'Nenhuma cidade nova registrada ainda desde o início do acompanhamento.');
  tabela('nov-quedas',[{t:'Nome',f:function(n){return n.n;}},{t:'Rede',f:function(n){return rede(n);}},{t:'Local',f:local},{t:'Último contato',f:function(n){return rel(n.v);}}],nov.quedas||[],'Nenhum nó nessa situação agora.');
  var cc=[{t:'Cidade',f:function(x){return x.m;}},{t:'UF',f:function(x){return x.uf;}},{t:'Ouvidos em 24 h',num:1,f:function(x){return x.h24;}},{t:'Nós no mapa',num:1,f:function(x){return x.tot;}}];
  tabela('nov-topc',cc,nov.top_cidades||[]);
  tabela('nov-topu',[{t:'UF',f:function(x){return x.uf;}},{t:'Ouvidos em 24 h',num:1,f:function(x){return x.h24;}},{t:'Nós no mapa',num:1,f:function(x){return x.tot;}}],nov.top_ufs||[]);
  tabela('nov-serie',[{t:'Dia',f:function(x){return x.d.slice(8,10)+'/'+x.d.slice(5,7);}},{t:'Meshtastic em 24 h',num:1,f:function(x){return x.mt;}},{t:'MeshCore em 24 h',num:1,f:function(x){return x.mc;}},{t:'Nós no mapa',num:1,f:function(x){return x.tot;}}],nov.serie||[]);}

// onde falta nó
var mapaLac=null;
function iniciaMapaLac(){if(mapaLac||!lac)return;
  mapaLac=L.map('mapa-lac',{preferCanvas:true}).fitBounds([[-19.6,-53.3],[-12.3,-45.8]]);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:17,attribution:'© OpenStreetMap'}).addTo(mapaLac);
  todos.filter(noMapa).forEach(function(n){if(n.la<-20||n.la>-12||n.lo<-54||n.lo>-44)return;
    var mc=n.t==='meshcore';
    L.circleMarker([n.la,n.lo],{radius:4,shape:mc?'square':'circle',color:'#fff',weight:1,fillColor:'#1b1f1c',fillOpacity:.9}).bindPopup(function(){return popup(n);}).addTo(mapaLac);});
  lac.cidades.forEach(function(x){var cor=x.d<=lac.lim_perto?'#16a34a':(x.d<=lac.lim_medio?'#f59e0b':'#dc2626');
    var m=L.circleMarker([x.la,x.lo],{radius:7,color:'#222',weight:1,fillColor:cor,fillOpacity:.7});
    m.bindPopup(x.c+': nó com resposta nos últimos 30 dias mais próximo a cerca de '+x.d+' km em linha reta'+(x.d>0?' ('+x.nm+(x.nu?' - '+x.nu:'')+')':'')+'.');m.addTo(mapaLac);});}
function lacunas(){if(!lac){$('lac-cartoes').textContent='Não consegui carregar os dados agora.';return;}
  $('lac-dias').textContent=lac.janela_dias;
  [].forEach.call(document.querySelectorAll('.lim1'),function(e){e.textContent=lac.lim_perto;});
  [].forEach.call(document.querySelectorAll('.lim2'),function(e){e.textContent=lac.lim_medio;});
  var c=$('lac-cartoes');c.textContent='';var cs=lac.cidades;
  var p=cs.filter(function(x){return x.d<=lac.lim_perto;}).length,l=cs.filter(function(x){return x.d>lac.lim_medio;}).length;
  card(c,cs.length,'municípios de Goiás');card(c,p,'até '+lac.lim_perto+' km de um nó');card(c,cs.length-p-l,lac.lim_perto+' a '+lac.lim_medio+' km');card(c,l,'mais de '+lac.lim_medio+' km');
  card(c,lac.nos_considerados,'nós com resposta nos últimos 30 dias (Brasil)');
  var top=cs.slice().sort(function(a,b){return b.d-a.d;}).slice(0,20);
  tabela('lac-top',[{t:'Município',f:function(x){return x.c;}},{t:'Distância ao nó mais próximo com resposta em 30 dias (km)',num:1,f:function(x){return x.d;}},{t:'Nó mais próximo em',f:function(x){return x.nm+(x.nu?' - '+x.nu:'');}},{t:'Rede',f:function(x){return x.nt==='meshcore'?'MeshCore':'Meshtastic';}}],top);
  tabela('lac-saltos',[{t:'Cidade A',f:function(x){return x.a;}},{t:'Cidade B (a mais próxima com nó)',f:function(x){return x.b;}},{t:'Distância (km)',num:1,f:function(x){return x.d;}}],lac.saltos||[],'Nenhum salto acima de '+lac.lim_medio+' km entre cidades goianas com nó.');}

// comunidade
function comunidade(){
  var links=document.querySelectorAll('.btn-zap');
  links.forEach(function(b){
    if(zap&&zap.whatsapp){
      b.href=zap.whatsapp;b.target='_blank';b.rel='noopener noreferrer';
      b.textContent='Entrar no grupo do WhatsApp';
      b.classList.remove('desativado');
      b.removeAttribute('aria-disabled');b.removeAttribute('tabindex');
    }else if(b.getAttribute('href')==='#comunidade'||b.classList.contains('desativado')){
      b.addEventListener('click',function(ev){ev.preventDefault();});
    }
  });
  if(zap&&zap.whatsapp&&$('zap-texto')){
    $('zap-texto').textContent='Entre no grupo para tirar dúvidas e conhecer quem monta nós na sua região. Leia as regras abaixo antes de participar.';
  }
}

function nosParaAlcance(){
  var uf=$('f-uf')?$('f-uf').value:'';
  return todos.filter(function(n){return noMapa(n)&&faixa(n)==='ativo'&&redeOn(n.t)&&(!uf||n.uf===uf);});}
function desenhaAlcance(){
  camadaAlcance.clearLayers();
  var cb=$('f-alcance');
  if(!cb||!cb.checked)return;
  if(!renderAlcance){renderAlcance=L.svg({padding:1});renderAlcance.addTo(mapa);}
  nosParaAlcance().forEach(function(n){
    L.circle([n.la,n.lo],{radius:RAIO_ALCANCE_M,color:'#16a34a',weight:2,opacity:.65,fillColor:'#16a34a',fillOpacity:.22,interactive:false,renderer:renderAlcance}).addTo(camadaAlcance);
  });
}

function mostraPertoBox(ok){var b=$('perto-box');if(!b)return;b.hidden=!ok;}
function msgPerto(t){var m=$('perto-msg');if(!m)return;m.textContent=t||'';}
function desenhaEu(){camadaEu.clearLayers();if(euLat==null)return;
  var ic=L.divIcon({className:'eu-icon',html:'<div class="eu-aqui"></div><div class="eu-rotulo">Você está aqui (aproximado)</div>',iconSize:[200,28],iconAnchor:[8,14],popupAnchor:[0,-12]});
  L.marker([euLat,euLon],{icon:ic,zIndexOffset:1000}).bindPopup('Você está aqui (posição aproximada). Esta informação fica só neste aparelho.').addTo(camadaEu);}
function candidatosPerto(){
  return todos.filter(function(n){return noMapa(n)&&redeOn(n.t);});}
function cincoProximos(lat,lon){
  var cand=candidatosPerto().map(function(n){return {n:n,km:km(lat,lon,n.la,n.lo)};});
  var verdes=cand.filter(function(x){return faixa(x.n)==='ativo';}).sort(function(a,b){return a.km-b.km;});
  var outros=cand.filter(function(x){return faixa(x.n)!=='ativo';}).sort(function(a,b){return a.km-b.km;});
  return verdes.concat(outros).slice(0,5);}
function atualizaPerto(){
  if(euLat==null)return;
  desenhaEu();
  var lst=cincoProximos(euLat,euLon);
  var ol=$('perto-lista');if(!ol)return;ol.textContent='';
  if(!lst.length){msgPerto('Não achei no mapa nenhum nó com resposta nos últimos 30 dias.');mostraPertoBox(true);return;}
  msgPerto('Os 5 nós mais próximos no mapa (até 30 dias), com prioridade para os ativos (verde). Distâncias são aproximadas (as posições dos nós já vêm arredondadas).');
  lst.forEach(function(x){var n=x.n,f=faixa(n),li=el('li');
    var kmTxt=fmtKm(x.km),dir=direcao(euLat,euLon,n.la,n.lo);
    var a=el('div',null,'p-km');a.appendChild(el('span',null,'pt c '+f)).className='pt c '+f;a.appendChild(document.createTextNode(' '+kmTxt));
    var b=el('div');b.appendChild(el('div',n.n,'p-nome'));
    b.appendChild(el('div',kmTxt+' a '+dir+' · '+ROTULO[f]+' · '+rede(n)+(local(n)?' · '+local(n):''),'p-det'));
    li.appendChild(a);li.appendChild(b);
    li.tabIndex=0;
    li.addEventListener('click',function(){mapa.setView([n.la,n.lo],Math.max(mapa.getZoom(),11));L.popup({maxWidth:280}).setLatLng([n.la,n.lo]).setContent(popup(n)).openOn(mapa);});
    li.addEventListener('keydown',function(ev){if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();li.click();}});
    ol.appendChild(li);});
  mostraPertoBox(true);}
function erroPerto(e){
  var t='Não consegui obter sua posição agora. Tente de novo em instantes.';
  if(!e||e.code===1)t='Não consegui usar a localização. Se quiser, permita o acesso nas configurações do navegador e toque de novo em Perto de mim.';
  else if(e.code===2)t='Sua posição não ficou disponível agora. Tente de novo em instantes, de preferência com o GPS ligado.';
  else if(e.code===3)t='A busca da sua posição demorou demais. Tente de novo.';
  msgPerto(t);mostraPertoBox(true);$('perto-lista').textContent='';}
function pedirPerto(){
  var btn=$('btn-perto');
  if(!navigator.geolocation){msgPerto('Este navegador não informa localização.');mostraPertoBox(true);return;}
  if(btn){btn.disabled=true;btn.textContent='Buscando sua posição…';}
  navigator.geolocation.getCurrentPosition(function(pos){
    // A posição fica só nestas variáveis, neste aparelho. Não vai a servidor, log nem armazenamento.
    euLat=pos.coords.latitude;euLon=pos.coords.longitude;
    atualizaPerto();
    var pts=[[euLat,euLon]].concat(cincoProximos(euLat,euLon).map(function(x){return [x.n.la,x.n.lo];}));
    try{mapa.fitBounds(pts,{maxZoom:11,padding:[40,40]});}catch(e){mapa.setView([euLat,euLon],10);}
    if(btn){btn.disabled=false;btn.textContent='Perto de mim';}
  },function(err){
    if(btn){btn.disabled=false;btn.textContent='Perto de mim';}
    erroPerto(err);
  },{enableHighAccuracy:false,timeout:15000,maximumAge:0});}

function tudo(){freqmc();regioes();compara();cartoes();desenha();inicio();online();estados();cidades();novidades();lacunas();comunidade();
  var bp=$('btn-perto');if(bp)bp.addEventListener('click',pedirPerto);}


['f-uf'].forEach(function(i){$(i).addEventListener('change',desenha);});
$('c-mt').addEventListener('change',filtrosRede);$('c-mc').addEventListener('change',filtrosRede);
$('f-ativos').addEventListener('change',desenha);
document.addEventListener('change',function(ev){if(ev.target&&ev.target.id==='f-alcance')desenhaAlcance();});
$('f-busca').addEventListener('input',desenha);
['o-janela','o-uf','o-rede'].forEach(function(i){$(i).addEventListener('change',online);});
['ci-rede','ci-uf'].forEach(function(i){$(i).addEventListener('change',cidades);});$('ci-busca').addEventListener('input',cidades);

function carrega(url){return fetch(url+(url.indexOf('?')>=0?'&':'?')+'t='+Math.floor(Date.now()/60000)).then(function(r){if(!r.ok)throw new Error(url);return r.json();});}
function opc(url){return carrega(url).catch(function(){return null;});}
Promise.all([carrega('data/nos_meshtastic.json?v=8c5e8102cf'),carrega('data/nos_meshcore.json?v=b7b4719196').catch(function(){return {nos:[],disponivel:false};}),opc('data/lacunas.json?v=6a8c73dbfc'),opc('data/novidades.json?v=c34acd02c0'),opc('data/comunidade.json?v=75e274a13f')])
.then(function(r){var a=r[0],b=r[1];lac=r[2];nov=r[3];zap=r[4];meta.mt=a.atualizado;meta.mc=b.atualizado;mcDisp=!!b.disponivel;
  todos=(a.nos||[]).concat(b.nos||[]);
  preencheUF($('f-uf'));preencheUF($('o-uf'));preencheUF($('ci-uf'));tudo();
  $('atualiza').textContent='Dados de '+dh(meta.mt)+'. A página confere de novo a cada visita.';
  var h=(location.hash||'').replace('#','');if(h&&(document.getElementById('aba-'+h)||ALIAS[h]))abre(h);
  setInterval(function(){cartoes();desenha();online();inicio();},60000);
  iniciaPresenca();iniciaForm();})
.catch(function(){$('atualiza').textContent='Não consegui carregar os dados agora. Tente de novo em instantes.';});

function cfg(){return window.__MDC||null;}
function visId(){try{var k='mdc_vid',v=sessionStorage.getItem(k);if(!v){v=Math.random().toString(36).slice(2)+Date.now().toString(36);sessionStorage.setItem(k,v);}return v;}catch(e){return String(Date.now());}}
function ntfy(path,opt){var c=cfg();if(!c||!c.n)return Promise.reject();return fetch(c.n+'/'+path,opt||{});}
function pulso(){var c=cfg();if(!c||!c.p)return;
  ntfy(c.p,{method:'POST',headers:{'Title':'','Priority':'min','TTL':'10m'},body:'v1:'+visId()}).catch(function(){});}
function contaVendo(){var c=cfg();if(!c||!c.p)return;
  ntfy(c.p+'/json?poll=1&since=10m').then(function(r){return r.ok?r.text():'';}).then(function(t){
    var ids={},corte=agora()-600;
    String(t).split('\n').forEach(function(lin){if(!lin)return;try{var m=JSON.parse(lin);var b=String(m.message||'');var tm=m.time||0;
      if(tm>=corte&&b.indexOf('v1:')===0)ids[b]=1;}catch(e){}});
    var n=Object.keys(ids).length,el=$('vendo');
    if(!n){el.hidden=true;return;}
    el.hidden=false;el.textContent=n===1?'1 pessoa vendo agora':(n+' pessoas vendo agora');
  }).catch(function(){});}
function iniciaPresenca(){if(!cfg()||!cfg().p)return;pulso();contaVendo();setInterval(pulso,7*60*1000);setInterval(contaVendo,40*1000);}
function iniciaForm(){var c=cfg(),form=$('form-contato');if(!form)return;
  if(!c||!c.f){$('form-status').textContent='O envio ainda não está disponível.';form.querySelector('button').disabled=true;return;}
  var t0=Date.now();
  form.addEventListener('submit',function(ev){ev.preventDefault();
    var st=$('form-status'),btn=$('form-enviar');
    var nome=(form.nome.value||'').trim().slice(0,80);
    var cidade=(form.cidade&&form.cidade.value||'').trim().slice(0,80);
    var msg=(form.mensagem.value||'').trim().slice(0,1000);
    if((form.website&&form.website.value)||(form._honey&&form._honey.value)){st.textContent='Mensagem enviada. Obrigado!';form.reset();return;}
    if(msg.length<3){st.textContent='Escreva uma mensagem (pelo menos 3 caracteres).';return;}
    if(Date.now()-t0<8000){st.textContent='Aguarde uns segundos e envie de novo.';return;}
    try{var ult=parseInt(localStorage.getItem('mdc_form_ts')||'0',10);if(Date.now()-ult<5*60*1000){st.textContent='Aguarde alguns minutos antes de enviar outra mensagem.';return;}}catch(e){}
    btn.disabled=true;st.textContent='Enviando…';
    var corpo=(nome?nome+'\n':'')+(cidade?'Cidade: '+cidade+'\n':'')+msg;
    ntfy(c.f,{method:'POST',headers:{'Title':'Comentário · Malha do Cerrado','Priority':'default','Tags':'mailbox_with_mail'},body:corpo})
      .then(function(r){if(!r.ok)throw new Error('falha');try{localStorage.setItem('mdc_form_ts',String(Date.now()));}catch(e){}
        st.textContent='Mensagem enviada. Obrigado!';form.reset();})
      .catch(function(){st.textContent='Não consegui enviar agora. Tente de novo em instantes.';})
      .then(function(){btn.disabled=false;});
  });}
})();
