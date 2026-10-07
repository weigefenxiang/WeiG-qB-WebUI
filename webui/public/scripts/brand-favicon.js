(function(global){
  'use strict';
  if(global.WeiGBrandFavicon)return;
  var ICON='assets/Wei.G.png',SIZE=64,RADIUS=30;
  function ensureLink(){var node=document.querySelector('link[rel~="icon"]');if(!node){node=document.createElement('link');node.rel='icon';document.head.appendChild(node);}return node;}
  function sourceFor(node){var saved=node.dataset.weigFaviconSource;if(saved)return saved;var current=node.getAttribute('href')||ICON;if(/^data:/i.test(current))current=ICON;node.dataset.weigFaviconSource=current;return current;}
  function fallback(node,source){node.href=source;node.dataset.weigFavicon='source';return node;}
  function apply(){var node=ensureLink(),source=sourceFor(node);node.href=source;node.dataset.weigFavicon='source';if(!global.Image||!document.createElement)return Promise.resolve(node);return new Promise(function(resolve){var image=new Image();image.decoding='async';image.onload=function(){try{var canvas=document.createElement('canvas'),ctx;canvas.width=SIZE;canvas.height=SIZE;ctx=canvas.getContext&&canvas.getContext('2d');if(!ctx){resolve(fallback(node,source));return;}ctx.clearRect(0,0,SIZE,SIZE);ctx.save();ctx.beginPath();ctx.arc(SIZE/2,SIZE/2,RADIUS,0,Math.PI*2);ctx.clip();ctx.drawImage(image,2,2,SIZE-4,SIZE-4);ctx.restore();node.href=canvas.toDataURL('image/png');node.dataset.weigFavicon='circular';resolve(node);}catch(_e){resolve(fallback(node,source));}};image.onerror=function(){resolve(fallback(node,source));};image.src=source;});}
  global.WeiGBrandFavicon={iconUrl:ICON,apply:apply};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});else apply();
})(window);
