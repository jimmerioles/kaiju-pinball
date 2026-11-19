import './style.css';
import { Game } from './game/game';

const container = document.getElementById('app');
if (!container) {
  throw new Error('Could not find the #app container.');
}

const game = new Game(container);
(window as unknown as { kaijuPinball: Game }).kaijuPinball = game;
