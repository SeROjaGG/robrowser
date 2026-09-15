/**
 * Renderer/Entity/EntityRangeRings.js
 *
 * SeROja: sight-range / attack-range ground rings around the local player.
 * Drawn as a 2D canvas overlay, not a real 3D ground decal -- there's no
 * "range ring" texture asset in the GRF to drive the skill-effect Cylinder
 * renderer. Samples points around the actual world-space circle (ground
 * plane = local X/Y, height is a separate axis) and projects each one
 * through the same matrix EntityLife.js uses, then draws a path through the
 * projected points -- this follows the camera's real rotation instead of
 * assuming world X/Y map to screen horizontal/vertical, which an isometric
 * camera never does (that assumption is what drew a flat line, not a ring).
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 */

import glMatrix from 'Utils/gl-matrix.js';
import GraphicsSettings from 'Preferences/Graphics.js';
import EntityOverlay from 'Renderer/Entity/EntityOverlay.js';

const vec4 = glMatrix.vec4;
const _pos = new Float32Array(4);
const SEGMENTS = 40;

const SIGHT_RANGE_TILES = 14; // rathena default battle_config.area_size

const canvas = document.createElement('canvas');
canvas.className = 'entity-range-rings';
canvas.style.position = 'absolute';
canvas.style.zIndex = 0;
canvas.style.pointerEvents = 'none';
const ctx = canvas.getContext('2d');

function projectToScreen(x, y, matrix) {
	_pos[0] = x;
	_pos[1] = y;
	_pos[2] = 0;
	_pos[3] = 1.0;
	vec4.transformMat4(_pos, _pos, matrix);
	const z = _pos[3] === 0.0 ? 1.0 : 1.0 / _pos[3];
	const halfW = window.innerWidth / 2;
	const halfH = window.innerHeight / 2;
	return [halfW + halfW * _pos[0] * z, halfH - halfH * _pos[1] * z];
}

function drawRing(matrix, radiusTiles, color) {
	if (radiusTiles <= 0) return;
	ctx.beginPath();
	for (let i = 0; i <= SEGMENTS; i++) {
		const angle = (i / SEGMENTS) * Math.PI * 2;
		const [sx, sy] = projectToScreen(Math.cos(angle) * radiusTiles, Math.sin(angle) * radiusTiles, matrix);
		if (i === 0) {
			ctx.moveTo(sx, sy);
		} else {
			ctx.lineTo(sx, sy);
		}
	}
	ctx.closePath();
	ctx.strokeStyle = color;
	ctx.lineWidth = 1.5;
	ctx.stroke();
}

/**
 * @param {mat4} matrix Local player's model-view-projection matrix
 * @param {number} attackRange Current weapon/skill attack range in tiles
 */
export default function renderRangeRings(matrix, attackRange) {
	const showSight = GraphicsSettings.showSightRange;
	const showAttack = GraphicsSettings.showAttackRange && attackRange > 0;

	if (!showSight && !showAttack) {
		canvas.style.display = 'none';
		return;
	}

	canvas.width = window.innerWidth;
	canvas.height = window.innerHeight;
	canvas.style.top = '0px';
	canvas.style.left = '0px';
	canvas.style.display = 'block';
	ctx.clearRect(0, 0, canvas.width, canvas.height);

	if (showSight) {
		drawRing(matrix, SIGHT_RANGE_TILES, 'rgba(120,170,255,0.55)');
	}
	if (showAttack) {
		drawRing(matrix, attackRange, 'rgba(255,90,90,0.65)');
	}

	EntityOverlay.append(canvas);
}
