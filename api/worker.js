const MANIFEST="https://launchermeta.mojang.com/mc/game/version_manifest_v2.json";
const XBOX="https://user.auth.xboxlive.com/user/authenticate";
const XSTS="https://xsts.auth.xboxlive.com/xsts/authorize";
const MC_LOGIN="https://api.minecraftservices.com/authentication/login_with_xbox";
const MC_ENT="https://api.minecraftservices.com/entitlements/mcstore";
const MC_PROFILE="https://api.minecraftservices.com/minecraft/profile";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"Content-Type","Access-Control-Allow-Methods":"GET,POST,OPTIONS","Cache-Control":"no-store"};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json",...cors}});
async function postJson(url,body){const r=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify(body)});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.errorMessage||d.error||"HTTP "+r.status);return d;}
async function minecraftAccount(msToken){
 if(!msToken)throw new Error("Missing Microsoft access token");
 const x=await postJson(XBOX,{Properties:{AuthMethod:"RPS",SiteName:"user.auth.xboxlive.com",RpsTicket:"d="+msToken},RelyingParty:"http://auth.xboxlive.com",TokenType:"JWT"});
 const xs=await postJson(XSTS,{Properties:{SandboxId:"RETAIL",UserTokens:[x.Token]},RelyingParty:"rp://api.minecraftservices.com/",TokenType:"JWT"});
 const uhs=xs.DisplayClaims?.xui?.[0]?.uhs;if(!uhs)throw new Error("Xbox XSTS did not return a user hash");
 const mc=await postJson(MC_LOGIN,{identityToken:"XBL3.0 x="+uhs+";"+xs.Token});
 const headers={Authorization:"Bearer "+mc.access_token};
 const ent=await fetch(MC_ENT,{headers});const entData=await ent.json();if(!ent.ok||!entData.items?.length)throw new Error("此 Microsoft 帳號沒有 Minecraft Java Edition entitlement");
 const p=await fetch(MC_PROFILE,{headers});const profile=await p.json();if(!p.ok)throw new Error(profile.errorMessage||"Minecraft profile unavailable");
 return {id:profile.id,name:profile.name,skins:profile.skins||[],capes:profile.capes||[]};
}
export default {async fetch(request){
 if(request.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
 const url=new URL(request.url);
 try{
  if(url.pathname==="/api/health")return json({ok:true,service:"minecraft-launch-api"});
  if(url.pathname==="/api/versions"){
   const r=await fetch(MANIFEST,{cf:{cacheTtl:300,cacheEverything:true}});if(!r.ok)throw new Error("Mojang manifest unavailable");
   const m=await r.json();const releases=m.versions.filter(v=>v.type==="release").slice(0,50);return json({latest:m.latest,versions:releases});
  }
  if(url.pathname==="/api/account"&&request.method==="POST"){const body=await request.json();return json(await minecraftAccount(body.accessToken));}
  return json({error:"Not found"},404);
 }catch(e){return json({error:e.message||"Server error"},400);}
}};