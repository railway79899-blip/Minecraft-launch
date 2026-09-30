const javaVersions=["1.21.8","1.21.5","1.20.6","1.20.1","1.19.4"];
const bedrockVersions=["1.21.92","1.21.90","1.21.80","1.21.70"];
let edition=localStorage.getItem("edition")||"java";
let versions=edition==="java"?javaVersions:bedrockVersions;
let selected=localStorage.getItem("version")||versions[0];
const $=id=>document.getElementById(id);
const api=window.launcherAPI;

async function loadDesktopConfig(){
  if(!api)return;
  const c=await api.getConfig();
  if(c.edition)edition=c.edition;
  if(c.version)selected=c.version;
  if(c.ram) $("ram").value=c.ram;
  if(c.gameDir) $("gameDir").value=c.gameDir;
  if(c.javaPath) $("javaPath").value=c.javaPath;
  if(c.jarPath) $("jarPath").value=c.jarPath;
}

function render(){
  versions=edition==="java"?javaVersions:bedrockVersions;
  if(!versions.includes(selected))selected=versions[0];
  $("currentVersion").textContent=selected;
  $("downloadVersion").textContent="Minecraft "+selected;
  $("editionLabel").textContent=edition==="java"?"JAVA EDITION":"BEDROCK EDITION";
  $("versionHint").textContent=edition==="java"?"選擇要使用的 Minecraft Java 版本。":"選擇要使用的 Minecraft Bedrock 版本。";
  $("versionList").innerHTML=versions.map(v=>'<div class="version"><span>☘ Minecraft '+(edition==="java"?"Java ":"Bedrock ")+v+'</span><button onclick="selectVersion(\''+v+'\')">選擇</button></div>').join("");
}

async function save(){
  localStorage.setItem("edition",edition);
  localStorage.setItem("version",selected);
  if(api)await api.setConfig({
    edition,version:selected,ram:Number($("ram").value),
    gameDir:$("gameDir").value,javaPath:$("javaPath").value,jarPath:$("jarPath").value
  });
}
async function selectVersion(v){
  selected=v;await save();render();document.querySelector('[data-page="home"]').click();
}

document.querySelectorAll(".edition").forEach(b=>b.onclick=async()=>{
  edition=b.dataset.edition;
  versions=edition==="java"?javaVersions:bedrockVersions;
  selected=versions[0];
  await save();
  document.querySelectorAll(".edition").forEach(x=>x.classList.toggle("active",x===b));
  render();
});

document.querySelectorAll("nav button").forEach(b=>b.onclick=()=>{
  document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
  $(b.dataset.page).classList.add("active");
  document.querySelectorAll("nav button").forEach(x=>x.classList.remove("active"));
  b.classList.add("active");
});

$("login").onclick=async()=>{
  if(api){
    await api.openExternal("https://www.minecraft.net/");
    $("desktopStatus").textContent="已開啟官方 Minecraft 網站；正式 Microsoft OAuth 需要註冊應用程式與官方授權設定。";
  }else alert("Java 與 Bedrock 都使用 Microsoft 帳號授權。");
};

$("play").onclick=async()=>{
  const s=$("status");
  if(edition==="bedrock"){
    if(api)await api.openExternal("minecraft:");
    $("desktopStatus").textContent="已要求開啟 Bedrock 官方平台協議；實際可用性取決於你的系統與官方安裝狀態。";
    s.textContent="已交給官方 Bedrock 啟動流程";
    return;
  }
  if(!api){
    s.textContent="瀏覽器預覽模式：請使用 Electron 啟動";
    return;
  }
  s.textContent="正在啟動 Java…";
  const result=await api.launchJava({
    javaPath:$("javaPath").value,
    jarPath:$("jarPath").value,
    gameDir:$("gameDir").value,
    ram:Number($("ram").value)
  });
  if(result.ok){
    s.textContent="Minecraft 已啟動";
    $("desktopStatus").textContent="Java 程序 PID: "+result.pid;
  }else{
    s.textContent="啟動失敗";
    $("desktopStatus").textContent=result.error;
  }
};

$("download").onclick=()=>{
  let n=0;$("downloadStatus").textContent="準備下載 "+selected+"…";
  const t=setInterval(()=>{
    n+=10;$("progress").style.width=n+"%";$("downloadStatus").textContent="下載中 "+n+"%";
    if(n>=100){clearInterval(t);$("downloadStatus").textContent="下載完成（目前仍為 UI 進度示意）";}
  },120);
};

$("ram").oninput=async e=>{ $("ramValue").textContent=e.target.value; await save(); };
$("gameDir").onchange=save;
$("javaPath").onchange=save;
$("jarPath").onchange=save;

$("chooseDir").onclick=async()=>{if(api){const p=await api.chooseDirectory();if(p){$("gameDir").value=p;await save();}}};
$("chooseJava").onclick=async()=>{if(api){const p=await api.chooseFile([{name:"Java",extensions:["exe","bin",""]}]);if(p){$("javaPath").value=p;await save();}}};
$("chooseJar").onclick=async()=>{if(api){const p=await api.chooseFile([{name:"Minecraft JAR",extensions:["jar"]}]);if(p){$("jarPath").value=p;await save();}}};

(async()=>{await loadDesktopConfig();document.querySelectorAll(".edition").forEach(x=>x.classList.toggle("active",x.dataset.edition===edition));$("ramValue").textContent=$("ram").value;render();})();