// Title screen over a slow aerial flyover of Coral Vista (New Game / Continue / Controls /
// Settings), the pause menu (Esc) with save and quit, the controls card and settings
// (volume, music, mouse sensitivity, shadows).
import { hasSave, saveInfo, saveGame } from '../state/save.js';
import { formatMoney } from '../core/mathx.js';

const CONTROLS = [
  ['W A S D', 'Move / drive'], ['Mouse', 'Look · aim'], ['Left click', 'Shoot · punch'], ['Right click', 'Aim'],
  ['Shift', 'Sprint'], ['Space', 'Jump · handbrake'], ['F', 'Enter · steal · exit car'], ['1-7 / wheel', 'Weapon rack'],
  ['R', 'Reload'], ['Z X C', 'Crew: plates · fix · lookout'], ['Q', 'Next radio station'], ['M', 'Map'],
  ['Enter', 'Skip dialogue'], ['Esc', 'Pause'],
];

export class Menu {
  constructor(game) {
    this.game = game;
    this.el = document.getElementById('menu');
    this.settings = Object.assign({ volume: 0.8, music: 0.6, sens: 1, shadows: true }, JSON.parse(localStorage.getItem('heatwave-settings') ?? '{}'));
    this.page = 'title';
  }

  saveSettings() {
    localStorage.setItem('heatwave-settings', JSON.stringify(this.settings));
    this.game.audio?.setVolume(this.settings.volume, this.settings.music);
    this.game.renderer.shadowMap.enabled = this.settings.shadows;
  }

  title() {
    this.page = 'title';
    const info = saveInfo();
    this.el.className = 'menu title';
    this.el.innerHTML = `
      <div class="logo"><h1>HEATWAVE</h1><h2>CORAL VISTA</h2><p>Sun. Sand. Bad debts.</p></div>
      <nav>
        <button data-act="new" class="primary">NEW GAME</button>
        <button data-act="continue" ${hasSave() ? '' : 'disabled'}>CONTINUE <small>${info ? `story ${info.story}/5 · ${formatMoney(info.money)}` : '· no save yet'}</small></button>
        <button data-act="controls">CONTROLS</button>
        <button data-act="settings">SETTINGS</button>
      </nav>
      <div class="features">5 story missions · open city · CVPD pursuits with air support<br>street races · cab fares · Coral Arms · crew abilities · 4 radio stations</div>
      <footer>An original open-world crime game · Coral Vista and everyone in it are fictional · Keyboard &amp; mouse</footer>`;
    this.bind();
  }

  pause() {
    this.page = 'pause';
    this.el.className = 'menu pause';
    this.el.innerHTML = `
      <div class="panel"><h2>PAUSED</h2>
        <button data-act="resume" class="primary">RESUME</button>
        <button data-act="map">MAP</button>
        <button data-act="save">SAVE GAME</button>
        <button data-act="controls">CONTROLS</button>
        <button data-act="settings">SETTINGS</button>
        <button data-act="quit">QUIT TO TITLE</button>
      </div>`;
    this.bind();
  }

  controls(back) {
    this.el.className = 'menu ' + back;
    this.el.innerHTML = `<div class="panel wide"><h2>CONTROLS</h2><div class="ctrl">${CONTROLS.map(([k, d]) => `<div><kbd>${k}</kbd><span>${d}</span></div>`).join('')}</div><button data-act="back" class="primary">BACK</button></div>`;
    this.bind(back);
  }

  settingsPage(back) {
    const s = this.settings;
    this.el.className = 'menu ' + back;
    this.el.innerHTML = `<div class="panel"><h2>SETTINGS</h2>
      <label>Master volume <input type="range" min="0" max="1" step="0.05" value="${s.volume}" data-k="volume"></label>
      <label>Radio volume <input type="range" min="0" max="1" step="0.05" value="${s.music}" data-k="music"></label>
      <label>Mouse sensitivity <input type="range" min="0.3" max="2.5" step="0.1" value="${s.sens}" data-k="sens"></label>
      <label>Shadows <input type="checkbox" ${s.shadows ? 'checked' : ''} data-k="shadows"></label>
      <button data-act="back" class="primary">BACK</button></div>`;
    this.el.querySelectorAll('input').forEach((i) => i.addEventListener('input', () => {
      s[i.dataset.k] = i.type === 'checkbox' ? i.checked : Number(i.value);
      this.saveSettings();
    }));
    this.bind(back);
  }

  bind(back = 'title') {
    const g = this.game;
    this.el.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
      g.audio?.unlock();
      g.audio?.blip();
      const act = b.dataset.act;
      if (act === 'new') g.newGame();
      else if (act === 'continue') g.continueGame();
      else if (act === 'controls') this.controls(this.page === 'pause' ? 'pause' : 'title');
      else if (act === 'settings') this.settingsPage(this.page === 'pause' ? 'pause' : 'title');
      else if (act === 'back') (back === 'pause' ? this.pause() : this.title());
      else if (act === 'resume') g.resume();
      else if (act === 'map') { this.hide(); g.openMap(); }
      else if (act === 'save') { if (saveGame(g)) { b.textContent = 'SAVED ✓'; } }
      else if (act === 'quit') location.reload();
    }));
  }

  hide() { this.el.className = 'menu hidden'; this.el.innerHTML = ''; }
}
