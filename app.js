(function(){
'use strict';
var H=3600, D=86400;
var todos=[], meta={}, mcDisp=false, lac=null, nov=null, zap=null;
function $(id){return document.getElementById(id);}
function el(t,txt,cls){var e=document.createElement(t);if(txt!=null)e.textContent=txt;if(cls)e.className=cls;return e;}
function agora(){return Math.floor(Date.now()/1000);}
function idade(v){if(!v)return null;return agora()-v;}
function rel(v){var s=idade(v);if(s==null)return 'sem registro';if(s<0)s=0;
  if(s<90)return 'agora há pouco';if(s<5400)return Math.round(s/60)+' min atrás';
  if(s<2*D)return Math.round(s/H)+' h atrás';return Math.round(s/D)+' dias atrás';}
function faixa(n){var s=idade(n.v);if(s==null)return 'velho';if(s<=H)return 'on';if(s<=D)return 'dia';return 'velho';}
var COR={meshtastic:'#16a34a',meshcore:'#7c3aed'};
function rede(n){return n.t==='meshcore'?'MeshCore':'Meshtastic';}
function dh(ep){if(!ep)return '';var d=new Date(ep*1000);
  return d.toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})+' (Brasília)';}
function dd(ep){if(!ep)return '';return new Date(ep*1000).toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit'});}
function local(n){return [n.m,n.uf].filter(Boolean).join(' - ');}
function nz(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();}

// abas (cada aba tem um endereço: #inicio, #mapa, #novidades, #lacunas, #cidades, #online, #comece, #sobre, #comunidade, #contato)
var ALIAS={guia:'comece',estados:'cidades'};
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
var mapa=L.map('mapa',{preferCanvas:true}).setView([-14.5,-52],4);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:17,attribution:'© OpenStreetMap'}).addTo(mapa);
var camadas={meshtastic:L.layerGroup().addTo(mapa),meshcore:L.layerGroup().addTo(mapa)};

function popup(n){var d=el('div');d.appendChild(el('strong',n.n));
  function lin(r,v){if(v){d.appendChild(el('br'));d.appendChild(document.createTextNode(r+': '+v));}}
  lin('Rede',rede(n));lin('Local',local(n));lin('Último contato',rel(n.v));
  lin('Placa',n.hw);lin('Papel',n.f);lin('Região',n.r);if(n.fr)lin('Frequência',String(n.fr).replace('.',',')+' MHz');lin('Preset',n.p);lin('Firmware',n.fw);
  if(n.c)lin('Nome curto',n.c);
  return d;}

function redeOn(t){return $(t==='meshcore'?'c-mc':'c-mt').checked;}
function filtrados(){
  var uf=$('f-uf').value,at=$('f-ativ').value,q=nz($('f-busca').value.trim());
  return todos.filter(function(n){
    if(!redeOn(n.t))return false;
    if(uf&&n.uf!==uf)return false;
    var s=idade(n.v);
    if(at==='1h'&&!(s!=null&&s<=H))return false;
    if(at==='24h'&&!(s!=null&&s<=D))return false;
    if(q&&nz(n.n+' '+n.m+' '+n.i+' '+n.c).indexOf(q)<0)return false;
    return true;});}

function desenha(){camadas.meshtastic.clearLayers();camadas.meshcore.clearLayers();var lst=filtrados();
  lst.forEach(function(n){var f=faixa(n);var c=COR[n.t];
    var m=L.circleMarker([n.la,n.lo],{radius:f==='on'?8:(f==='dia'?6:4),color:'#fff',weight:1,fillColor:c,fillOpacity:f==='on'?.95:(f==='dia'?.7:.35)});
    m.bindPopup(function(){return popup(n);});m.addTo(camadas[n.t]);});
  $('f-busca').title=lst.length+' nós no mapa';
  cartoes();}
function filtrosRede(){desenha();}

function contagem(lst){var r={tot:lst.length,h1:0,h24:0};
  lst.forEach(function(n){var s=idade(n.v);if(s!=null&&s<=H)r.h1++;if(s!=null&&s<=D)r.h24++;});return r;}
function card(c,v,t){var x=el('div',null,'cartao');x.appendChild(el('b',String(v)));x.appendChild(el('span',t));c.appendChild(x);}

function cartoes(){var c=$('cartoes');c.textContent='';
  var lst=filtrados();var a=contagem(lst);
  var mt=lst.filter(function(n){return n.t==='meshtastic';}).length,mc=lst.length-mt;
  card(c,a.h1,'online agora (1 h)');card(c,a.h24,'ouvidos em 24 h');card(c,a.tot,'nós na seleção');
  card(c,mt,'Meshtastic');card(c,mcDisp?mc:'em breve','MeshCore');}

function inicio(){var c=$('cartoes-inicio');c.textContent='';
  var go=todos.filter(function(n){return n.uf==='GO';});var a=contagem(todos),g=contagem(go);
  var mt=todos.filter(function(n){return n.t==='meshtastic';}).length;
  var ufs={};todos.forEach(function(n){if(n.uf)ufs[n.uf]=1;});
  var cgo={};go.forEach(function(n){if(n.m)cgo[n.m]=1;});
  card(c,todos.length,'nós no Brasil');card(c,a.h24,'ouvidos em 24 h');card(c,Object.keys(ufs).length,'estados com nós');
  card(c,go.length,'nós em Goiás');card(c,Object.keys(cgo).length,'cidades de Goiás com nó');
  var p=$('goias-resumo');
  var t='Em Goiás há '+go.length+' nós no mapa ('+go.filter(function(n){return n.t==='meshtastic';}).length+' Meshtastic e '+go.filter(function(n){return n.t==='meshcore';}).length+' MeshCore), '+g.h24+' ouvidos nas últimas 24 h. ';
  if(lac&&lac.cidades){var longe=lac.cidades.filter(function(x){return x.d>lac.lim_medio;}).length;
    t+='Dos '+lac.cidades.length+' municípios goianos, '+longe+' ficam a mais de '+lac.lim_medio+' km de qualquer nó ativo conhecido (estimativa simples em linha reta). ';}
  t+='Rede Brasil: '+mt+' Meshtastic e '+(todos.length-mt)+' MeshCore. Dados de '+dh(meta.mt)+'.';
  p.textContent=t;}

function ufs(){var s={};todos.forEach(function(n){if(n.uf)s[n.uf]=1;});return Object.keys(s).sort();}
function preencheUF(sel){ufs().forEach(function(u){var o=el('option',u);o.value=u;sel.appendChild(o);});}

function tabela(alvo,cols,linhas,vazio){var w=$(alvo);w.textContent='';
  if(!linhas.length){w.appendChild(el('p',vazio||'Nada para mostrar por enquanto.','nota'));return;}
  var wrap=el('div',null,'tabela-wrap'),t=el('table'),th=el('thead'),tr=el('tr');
  cols.forEach(function(c){var x=el('th',c.t);if(c.num)x.className='num';tr.appendChild(x);});th.appendChild(tr);t.appendChild(th);
  var tb=el('tbody');linhas.forEach(function(l){var r=el('tr');cols.forEach(function(c){var v=c.f(l);var x=el('td',v==null||v===''?'-':String(v));if(c.num)x.className='num';r.appendChild(x);});tb.appendChild(r);});
  t.appendChild(tb);wrap.appendChild(t);w.appendChild(wrap);}

// quem está online
function online(){var tb=document.querySelector('#tab-online tbody');tb.textContent='';
  var lim=$('o-janela').value==='1h'?H:D,uf=$('o-uf').value,rd=$('o-rede').value;
  var lst=todos.filter(function(n){var s=idade(n.v);return s!=null&&s<=lim&&(!uf||n.uf===uf)&&(rd==='todas'||n.t===rd);}).sort(function(a,b){return b.v-a.v;});
  lst.slice(0,500).forEach(function(n){var tr=el('tr');
    [n.n,rede(n),local(n),n.hw,n.f,rel(n.v)].forEach(function(v){tr.appendChild(el('td',v||'-'));});
    tb.appendChild(tr);});
  $('o-resumo').textContent=lst.length+' nós'+(lst.length>500?' (mostrando os 500 mais recentes)':'')+'.';}

// cidades (ficha por cidade) e estados
function cidades(){var tb=document.querySelector('#tab-cidades tbody');tb.textContent='';
  var rd=$('ci-rede').value,uf=$('ci-uf').value,q=nz($('ci-busca').value.trim());var m={};
  todos.forEach(function(n){if(!n.m||!n.uf)return;if(rd!=='todas'&&n.t!==rd)return;if(uf&&n.uf!==uf)return;if(q&&nz(n.m).indexOf(q)<0)return;
    var k=n.uf+'|'+n.m;var x=m[k]||(m[k]={m:n.m,uf:n.uf,tot:0,h1:0,h24:0,mt:0,mtH:0,mc:0,mcH:0});
    var s=idade(n.v),on=s!=null&&s<=H;x.tot++;if(on)x.h1++;if(s!=null&&s<=D)x.h24++;
    if(n.t==='meshcore'){x.mc++;if(on)x.mcH++;}else{x.mt++;if(on)x.mtH++;}});
  var l=Object.keys(m).map(function(k){return m[k];}).sort(function(a,b){return b.h1-a.h1||b.h24-a.h24||b.tot-a.tot||a.m.localeCompare(b.m);});
  $('ci-resumo').textContent=l.length+' cidades com nós'+(l.length>300?' (mostrando as 300 primeiras; use a busca)':'')+'.';
  l.slice(0,300).forEach(function(x){var tr=el('tr',null,'clic');
    [x.m,x.uf,x.tot,x.h1,x.h24,x.mt+' ('+x.mtH+')',mcDisp?x.mc+' ('+x.mcH+')':'-'].forEach(function(v,i){var td=el('td',String(v));if(i>1)td.className='num';tr.appendChild(td);});
    tr.addEventListener('click',function(){ficha(x.m,x.uf);});tb.appendChild(tr);});}

function ficha(cid,uf){var f=$('ficha');f.textContent='';f.hidden=false;
  var ns=todos.filter(function(n){return n.m===cid&&n.uf===uf;}).sort(function(a,b){return (b.v||0)-(a.v||0);});
  f.appendChild(el('h3','Ficha de '+cid+' - '+uf));
  var c=el('div',null,'cartoes');
  ['meshtastic','meshcore'].forEach(function(t){var l=ns.filter(function(n){return n.t===t;});var on=l.filter(function(n){var s=idade(n.v);return s!=null&&s<=H;}).length;var d24=l.filter(function(n){var s=idade(n.v);return s!=null&&s<=D;}).length;
    card(c,l.length,(t==='meshcore'?'MeshCore':'Meshtastic')+': '+on+' online, '+d24+' em 24 h');});
  f.appendChild(c);
  if(lac&&uf==='GO'){var x=lac.cidades.filter(function(y){return y.c===cid;})[0];
    if(x)f.appendChild(el('p','Nó ativo mais próximo (estimativa em linha reta): '+(x.d)+' km'+(x.d>0?' ('+x.nm+(x.nu?' - '+x.nu:'')+')':'')+'.','nota'));}
  var ul=el('ul');ns.slice(0,30).forEach(function(n){ul.appendChild(el('li',n.n+' · '+rede(n)+' · último contato '+rel(n.v)));});f.appendChild(ul);
  var b=el('button','Ver no mapa','botao');b.type='button';b.addEventListener('click',function(){$('f-uf').value=uf;$('f-busca').value=cid;desenha();abre('mapa');mapa.fitBounds(ns.map(function(n){return [n.la,n.lo];}),{maxZoom:12,padding:[30,30]});});
  f.appendChild(b);f.scrollIntoView({behavior:'smooth',block:'nearest'});}

function estados(){var tb=document.querySelector('#tab-estados tbody');tb.textContent='';
  var m={};todos.forEach(function(n){var u=n.uf||'?';var x=m[u]||(m[u]={uf:u,tot:0,h1:0,h24:0,mt:0,mc:0});
    x.tot++;if(n.t==='meshcore')x.mc++;else x.mt++;var s=idade(n.v);if(s!=null&&s<=H)x.h1++;if(s!=null&&s<=D)x.h24++;});
  Object.keys(m).map(function(k){return m[k];}).sort(function(a,b){return b.tot-a.tot;}).forEach(function(x){
    var tr=el('tr',null,'clic');
    [x.uf==='?'?'sem UF':x.uf,x.tot,x.h1,x.h24,x.mt,mcDisp?x.mc:'-'].forEach(function(v,i){var td=el('td',String(v));if(i>0)td.className='num';tr.appendChild(td);});
    tr.addEventListener('click',function(){if(x.uf!=='?'){$('f-uf').value=x.uf;$('f-busca').value='';desenha();abre('mapa');
      var p=todos.filter(function(n){return n.uf===x.uf;}).map(function(n){return [n.la,n.lo];});if(p.length)mapa.fitBounds(p,{maxZoom:9,padding:[20,20]});}});
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
  $('comp-dados').textContent='No mapa hoje: '+mt+' nós Meshtastic e '+mc+' MeshCore no Brasil; em Goiás, '+gm+' Meshtastic e '+(go.length-gm)+' MeshCore.';
  var h={};todos.forEach(function(n){var x=(n.hw||'').trim();if(x&&x!=='UNSET')h[x]=(h[x]||0)+1;});
  var ks=Object.keys(h).sort(function(a,b){return h[b]-h[a];}).slice(0,6);
  $('hw-dados').textContent=ks.length?'Para ter uma ideia do que a comunidade usa, estas são as placas que mais aparecem no mapa: '+ks.map(function(k){return k+' ('+h[k]+')';}).join(', ')+'. Não é recomendação de compra.':'';}

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
  var idade30=lac.janela_dias*D;
  todos.forEach(function(n){if(!n.v||agora()-n.v>idade30)return;if(n.la<-20||n.la>-12||n.lo<-54||n.lo>-44)return;
    L.circleMarker([n.la,n.lo],{radius:4,color:'#fff',weight:1,fillColor:COR[n.t],fillOpacity:.9}).bindPopup(function(){return popup(n);}).addTo(mapaLac);});
  lac.cidades.forEach(function(x){var cor=x.d<=lac.lim_perto?'#16a34a':(x.d<=lac.lim_medio?'#f59e0b':'#dc2626');
    var m=L.circleMarker([x.la,x.lo],{radius:7,color:'#222',weight:1,fillColor:cor,fillOpacity:.7});
    m.bindPopup(x.c+': nó ativo mais próximo a cerca de '+x.d+' km em linha reta'+(x.d>0?' ('+x.nm+(x.nu?' - '+x.nu:'')+')':'')+'.');m.addTo(mapaLac);});}
function lacunas(){if(!lac){$('lac-cartoes').textContent='Não consegui carregar os dados agora.';return;}
  $('lac-dias').textContent=lac.janela_dias;
  [].forEach.call(document.querySelectorAll('.lim1'),function(e){e.textContent=lac.lim_perto;});
  [].forEach.call(document.querySelectorAll('.lim2'),function(e){e.textContent=lac.lim_medio;});
  var c=$('lac-cartoes');c.textContent='';var cs=lac.cidades;
  var p=cs.filter(function(x){return x.d<=lac.lim_perto;}).length,l=cs.filter(function(x){return x.d>lac.lim_medio;}).length;
  card(c,cs.length,'municípios de Goiás');card(c,p,'até '+lac.lim_perto+' km de um nó');card(c,cs.length-p-l,lac.lim_perto+' a '+lac.lim_medio+' km');card(c,l,'mais de '+lac.lim_medio+' km');card(c,lac.nos_considerados,'nós ativos considerados (Brasil)');
  var top=cs.slice().sort(function(a,b){return b.d-a.d;}).slice(0,20);
  tabela('lac-top',[{t:'Município',f:function(x){return x.c;}},{t:'Distância ao nó ativo mais próximo (km)',num:1,f:function(x){return x.d;}},{t:'Nó mais próximo em',f:function(x){return x.nm+(x.nu?' - '+x.nu:'');}},{t:'Rede',f:function(x){return x.nt==='meshcore'?'MeshCore':'Meshtastic';}}],top);
  tabela('lac-saltos',[{t:'Cidade A',f:function(x){return x.a;}},{t:'Cidade B (a mais próxima com nó)',f:function(x){return x.b;}},{t:'Distância (km)',num:1,f:function(x){return x.d;}}],lac.saltos||[],'Nenhum salto acima de '+lac.lim_medio+' km entre cidades goianas com nó.');}

// comunidade
function comunidade(){var b=$('zap-botao');
  if(zap&&zap.whatsapp){b.href=zap.whatsapp;b.target='_blank';b.rel='noopener';b.textContent='Entrar no grupo do WhatsApp';b.classList.remove('desativado');b.removeAttribute('aria-disabled');b.removeAttribute('tabindex');
    $('zap-texto').textContent='Entre no grupo para tirar dúvidas e conhecer quem monta nós na sua região. Leia as regras abaixo antes de participar.';
    b.addEventListener('click',function(ev){ev.stopPropagation();});}
  else{b.addEventListener('click',function(ev){ev.preventDefault();});}}

function tudo(){freqmc();regioes();compara();cartoes();desenha();inicio();online();estados();cidades();novidades();lacunas();comunidade();}

['f-uf','f-ativ'].forEach(function(i){$(i).addEventListener('change',desenha);});
$('c-mt').addEventListener('change',filtrosRede);$('c-mc').addEventListener('change',filtrosRede);
$('f-busca').addEventListener('input',desenha);
['o-janela','o-uf','o-rede'].forEach(function(i){$(i).addEventListener('change',online);});
['ci-rede','ci-uf'].forEach(function(i){$(i).addEventListener('change',cidades);});$('ci-busca').addEventListener('input',cidades);

function carrega(url){return fetch(url+'?t='+Math.floor(Date.now()/60000)).then(function(r){if(!r.ok)throw new Error(url);return r.json();});}
function opc(url){return carrega(url).catch(function(){return null;});}
Promise.all([carrega('data/nos_meshtastic.json'),carrega('data/nos_meshcore.json').catch(function(){return {nos:[],disponivel:false};}),opc('data/lacunas.json'),opc('data/novidades.json'),opc('data/comunidade.json')])
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
    var msg=(form.mensagem.value||'').trim().slice(0,1000);
    if(form.website.value){st.textContent='Mensagem enviada. Obrigado!';form.reset();return;}
    if(msg.length<3){st.textContent='Escreva uma mensagem (pelo menos 3 caracteres).';return;}
    if(Date.now()-t0<8000){st.textContent='Aguarde uns segundos e envie de novo.';return;}
    try{var ult=parseInt(localStorage.getItem('mdc_form_ts')||'0',10);if(Date.now()-ult<5*60*1000){st.textContent='Aguarde alguns minutos antes de enviar outra mensagem.';return;}}catch(e){}
    btn.disabled=true;st.textContent='Enviando…';
    var corpo=(nome?nome+':\n':'')+msg;
    ntfy(c.f,{method:'POST',headers:{'Title':'Comentário · Malha do Cerrado','Priority':'default','Tags':'mailbox_with_mail'},body:corpo})
      .then(function(r){if(!r.ok)throw new Error('falha');try{localStorage.setItem('mdc_form_ts',String(Date.now()));}catch(e){}
        st.textContent='Mensagem enviada. Obrigado!';form.reset();})
      .catch(function(){st.textContent='Não consegui enviar agora. Tente de novo em instantes.';})
      .then(function(){btn.disabled=false;});
  });}
})();
