import "./index.scss";
import Base from "@js/layouts/base";

Base();
console.log("Hello World!");
// countdown timer updates #countdown every second
// countdown starts 1 hour before the event
// format: 00:00:00
// when countdown reaches 0, hide #countdown and show #live
// when #live is shown, start the live stream
// when #live is shown, hide #countdown

let countdown = document.getElementById("countdown");
let live = document.getElementById("live");
let countdownInterval = null;
let countdownTime = 3900;

function updateCountdown() {
  let hours = ("0" + Math.floor(countdownTime / 3600)).slice(-2);
  let minutes = ("0" + Math.floor((countdownTime % 3600) / 60)).slice(-2);
  let seconds = ("0" + (countdownTime % 60)).slice(-2);

  countdown.innerHTML = `
    <span>${hours[0]}</span>
    <span>${hours[1]}</span>
    <span>:</span>
    <span>${minutes[0]}</span>
    <span>${minutes[1]}</span>
    <span>:</span>
    <span>${seconds[0]}</span>
    <span>${seconds[1]}</span>
  `;

  if (countdownTime <= 0) {
    clearInterval(countdownInterval);
    countdown.classList.add("hidden");
    live.classList.remove("hidden");
  }

  countdownTime--;
}

countdownInterval = setInterval(updateCountdown, 1000);
updateCountdown();
