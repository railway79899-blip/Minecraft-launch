const versions=["1.21.8","1.21.5","1.20.6","1.20.1","1.19.4"];let selected=localStorage.getItem("version")||versions[0];
const $=id=>document.getElementById(id);
function render(){ $("currentVersion").textContent=selected;$("downloadVersion").textContent="Minecraft "+selected;$("versionList").innerHTML=versions.map(v=>'<div class="version"><span>☘ Minecraft Java '+v+'</span><button onclick="selectVersion(\''+v+'\')">選擇</button></div>').join("")}
function selectVersion(v){selected=v;localStorage.setItem("version",v);render();document.querySelector('[data-page="home"]').click()}
document.querySelectorAll("nav button").forEach(b=>b.onclick=()=>{document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));$(b.dataset.page).classList.add("active");document.querySelectorAll("nav button").forEach(x=>x.classList.remove("active"));b.classList.add("active")});
$("login").onclick=()=>alert("正式登入將導向 Microsoft 官方授權流程。此原型不會繞過帳號驗證。");
$("play").onclick=()=>{const s=$("status");s.textContent="已選擇 "+selected+"，請先完成正式帳號驗證";setTimeout(()=>s.textContent="就緒",3000)};
$("download").onclick=()=>{let n=0;$("downloadStatus").textContent="準備下載 "+selected+"…";const t=setInterval(()=>{n+=10;$("progress").style.width=n+"%";$("downloadStatus").textContent="下載中 "+n+"%";if(n>=100){clearInterval(t);$("downloadStatus").textContent="下載完成（UI 模擬）"}},120)};
$("ram").oninput=e=>$("ramValue").textContent=e.target.value;render();