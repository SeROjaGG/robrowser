/**
 * UI/Components/CharSelect/charSprite.js
 *
 * eXRo (PLAN-009) — shared character-sprite canvas helper.
 *
 * The build + one-frame draw lifted (copied, not imported) from the render
 * routines in CharSelectCommon.js / CharCreateCommon.js so the standalone
 * CharSelectExro / CharCreateExro components can draw RO sprites without
 * touching the stock factory files. The animating render loop
 * (Renderer.render / Renderer.stop) stays owned by each component's
 * onAppend / onRemove, exactly as the stock V4 does.
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 */

import Entity from 'Renderer/Entity/Entity.js';
import SpriteRenderer from 'Renderer/SpriteRenderer.js';
import StatusConst from 'DB/Status/StatusState.js';
import Camera from 'Renderer/Camera.js';

/**
 * Build an Entity from a full character-list slot (char-select).
 * Mirrors CharSelectCommon.js `addCharacter`.
 *
 * @param {object} charInfo - one entry from parseCharList()
 * @param {number} fallbackSex - account sex, used when the slot omits it
 * @returns {Entity}
 */
export function makeCharEntity(charInfo, fallbackSex) {
	const info = Object.assign({}, charInfo);
	if (!('sex' in info) || info.sex === 99) {
		info.sex = fallbackSex || 0;
	}

	const entity = new Entity();
	entity.set(info);
	entity.effectState = entity._effectState & ~StatusConst.EffectState.INVISIBLE;
	entity.hideShadow = true;
	entity.setAction({
		action: entity.ACTION.IDLE,
		frame: 0,
		play: true,
		repeat: true
	});
	return entity;
}

/**
 * Build a preview Entity (char-create). Mirrors CharCreateCommon.js
 * `_model.entity.set({...})` — every field goes through a single `set()` call
 * so the sprite/body actually (re)loads; poking `.job` etc. directly leaves the
 * body sprite stale (only the head reloads).
 *
 * @param {object} props - { job, sex, head, headpalette, direction }
 * @returns {Entity}
 */
export function makePreviewEntity(props) {
	const entity = new Entity();
	entity.set({
		sex: props.sex || 0,
		job: props.job || 0,
		head: props.head || 1,
		headpalette: props.headpalette || 0,
		action: 0,
		direction: typeof props.direction === 'number' ? props.direction : 4
	});
	entity.effectState = entity._effectState & ~StatusConst.EffectState.INVISIBLE;
	entity.hideShadow = true;
	return entity;
}

/**
 * Draw one frame of a char-select entity. Facing comes from the camera
 * (Camera.direction = 4), matching CharSelectCommon.js renderPaginated/renderGrid.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Entity} entity
 * @param {number} x - sprite anchor x in canvas px
 * @param {number} y - sprite anchor y in canvas px
 */
export function drawCharEntity(ctx, entity, x, y) {
	if (!ctx || !entity) {
		return;
	}
	Camera.direction = 4;
	ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
	SpriteRenderer.bind2DContext(ctx, x, y);
	entity.renderEntity();
}

/**
 * Draw one frame of the char-create preview. Facing comes from the entity's
 * own `.direction` (set via `.set({direction})`), matching CharCreateCommon.js
 * renderRace — the camera is left alone.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Entity} entity
 * @param {number} x
 * @param {number} y
 */
export function drawPreviewEntity(ctx, entity, x, y) {
	if (!ctx || !entity) {
		return;
	}
	ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
	SpriteRenderer.bind2DContext(ctx, x, y);
	entity.renderEntity();
}
