const fallbackJava=["1.21.8","1.21.5","1.20.6","1.20.1","1.19.4"];
const bedrockVersions=["1.21.92","1.21.90","1.21.80","1.21.70"];
let javaVersions=[...fallbackJava];
let edition=localStorage.getItem("edition")||"java";
let versions=edition==="java"?javaVersions:bedrockVersions;
let selected=localStorage.getItem("version")||versions[0];
let account=null;
const $=id=>document.getElementById(id), api=window.launcherAPI;

async function save(){
  localStorage.setItem("edition",edition); localStorage.setItem("version",selected);
  if(api) await api.setConfig({edition,version:selected,ram:Number($("ram").value),gameDir:$("gameDir").value,javaPath:$("javaPath").value,clientId:$("clientId").value});
}
async function load(){
  if(!api)return;
  const c=await api.getConfig();
  if(c.edition)edition=c.edition; if(c.version)selected=c.version;
  if(c.ram)$("ram").value=c.ram; if(c.gameDir)$("gameDir").value=c.gameDir; if(c.javaPath)$("javaPath").value=c.javaPath; if(c.clientId)$("clientId").value=c.clientId;
  account=await api.authStatus(); renderAccount();
}
function renderAccount(){
  const name=account?.name||"未登入"; $("account").textContent=name; $("headerAccount").textContent=name;
  $("login").hidden=!!account; $("logout").hidden=!account;
  $("avatar").src=account?.skins?.[0]?.url||"";
  $("avatar").style.display=account?.skins?.[0]?.url?"block":"none";
}
function render(){
  versions=edition==="java"?javaVersions:bedrockVersions;
  if(!versions.includes(selected))selected=versions[0];
  $("currentVersion").textContent=selected; $("downloadVersion").textContent="Minecraft "+selected;
  $("editionLabel").textContent=edition==="java"?"JAVA EDITION":"BEDROCK EDITION";
  $("versionHint").textContent=edition==="java"?"選擇正式版 Minecraft Java 版本。":"選擇 Minecraft Bedrock 版本。";
  $("versionList").innerHTML=versions.map(v=>`<div class="version"><span>☘ Minecraft ${edition==="java"?"Java ":"Bedrock "}${v}</span><button data-version="${v}">選擇</button></div>`).join("");
  document.querySelectorAll(".version button").forEach(b=>b.onclick=async()=>{selected=b.dataset.version;await save();render();});
}
async function runLogin(){
  try{$("status").textContent="正在開啟 Microsoft 登入…"; account=await api.login(); renderAccount(); $("status").textContent="已授權"; $("desktopStatus").textContent="Microsoft 帳號與 Minecraft Java entitlement 已驗證。";}
  catch(e){$("status").textContent="登入失敗";$("desktopStatus").textContent=e.message||String(e);}
}
$("login").onclick=runLogin;
$("logout").onclick=async()=>{await api.logout();account=null;renderAccount();$("status").textContent="已登出";};
document.querySelectorAll(".edition").forEach(b=>b.onclick=async()=>{edition=b.dataset.edition;versions=edition==="java"?javaVersions:bedrockVersions;selected=versions[0];await save();document.querySelectorAll(".edition").forEach(x=>x.classList.toggle("active",x===b));render();});
document.querySelectorAll("nav button").forEach(b=>b.onclick=()=>{document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));$(b.dataset.page).classList.add("active");document.querySelectorAll("nav button").forEach(x=>x.classList.remove("active"));b.classList.add("active");});
async function prepare(){
  if(edition!=="java"){await api.openExternal("minecraft:");$("desktopStatus").textContent="已交給系統官方 Bedrock 啟動協議。";return;}
  if(!account){$("status").textContent="請先登入 Microsoft";return;}
  $("status").textContent="準備遊戲檔…";$("downloadStatus").textContent="正在取得官方版本、libraries、natives 與 assets…";
  $("progress").style.width="0%";
  try{const result=await api.prepare({version:selected,gameDir:$("gameDir").value});$("progress").style.width="100%";$("downloadStatus").textContent="準備完成："+result.jarPath;$("status").textContent="遊戲檔已準備";}
  catch(e){$("status").textContent="準備失敗";$("downloadStatus").textContent=e.message||String(e);}
}
$("download").onclick=prepare;
$("play").onclick=async()=>{
  if(edition==="bedrock"){await api.openExternal("minecraft:");return;}
  if(!account){await runLogin();if(!account)return;}
  $("status").textContent="正在準備並啟動…";
  try{const r=await api.launchJava({javaPath:$("javaPath").value,gameDir:$("gameDir").value,version:selected,ram:Number($("ram").value)});$("status").textContent="Minecraft 已啟動";$("desktopStatus").textContent="Java PID: "+r.pid;}
  catch(e){$("status").textContent="啟動失敗";$("desktopStatus").textContent=e.message||String(e);}
};
api?.onProgress(p=>{$("progress").style.width=Math.round(p*100)+"%";$("downloadStatus").textContent="準備遊戲檔 "+Math.round(p*100)+"%";});
api?.onLog(log=>{if(log.type==="stderr"&&log.value)$("desktopStatus").textContent=log.value.slice(-300);});
$("ram").oninput=async e=>{$("ramValue").textContent=e.target.value;await save();};
["gameDir","javaPath","clientId"].forEach(id=>$(id).onchange=save);
$("chooseDir").onclick=async()=>{const p=await api.chooseDirectory();if(p){$("gameDir").value=p;await save();}};
$("chooseJava").onclick=async()=>{const p=await api.chooseFile([{name:"Java",extensions:["exe","bin"]}]);if(p){$("javaPath").value=p;await save();}};
(async()=>{await load();document.querySelectorAll(".edition").forEach(x=>x.classList.toggle("active",x.dataset.edition===edition));$("ramValue").textContent=$("ram").value;render();})();