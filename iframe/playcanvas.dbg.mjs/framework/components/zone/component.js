import { Vec3 } from '../../../core/math/vec3.js';
import { Component } from '../component.js';

/**
 * The ZoneComponent allows you to define an area in world space of certain size. This can be used
 * in various ways, such as affecting audio reverb when {@link AudioListenerComponent} is within
 * zone. Or create culling system with portals between zones to hide whole indoor sections for
 * performance reasons. And many other possible options. Zones are building blocks and meant to be
 * used in many different ways.
 *
 * @augments Component
 * @ignore
 */
class ZoneComponent extends Component {
  /**
   * Create a new ZoneComponent instance.
   *
   * @param {import('./system.js').ZoneComponentSystem} system - The ComponentSystem that
   * created this Component.
   * @param {import('../../entity.js').Entity} entity - The Entity that this Component is
   * attached to.
   */
  constructor(system, entity) {
    super(system, entity);
    this._oldState = true;
    this._size = new Vec3();
    this.on('set_enabled', this._onSetEnabled, this);
  }

  /**
   * The size of the axis-aligned box of this ZoneComponent.
   *
   * @type {Vec3}
   */
  set size(data) {
    if (data instanceof Vec3) {
      this._size.copy(data);
    } else if (data instanceof Array && data.length >= 3) {
      this.size.set(data[0], data[1], data[2]);
    }
  }
  get size() {
    return this._size;
  }
  onEnable() {
    this._checkState();
  }
  onDisable() {
    this._checkState();
  }
  _onSetEnabled(prop, old, value) {
    this._checkState();
  }
  _checkState() {
    const state = this.enabled && this.entity.enabled;
    if (state === this._oldState) return;
    this._oldState = state;
    this.fire('enable');
    this.fire('state', this.enabled);
  }
  _onBeforeRemove() {
    this.fire('remove');
  }
}
/**
 * Fired when the zone component is enabled. This event does not take into account the enabled
 * state of the entity or any of its ancestors.
 *
 * @event
 * @example
 * entity.zone.on('enable', () => {
 *     console.log(`Zone component of entity '${entity.name}' has been enabled`);
 * });
 */
ZoneComponent.EVENT_ENABLE = 'enable';
/**
 * Fired when the zone component is disabled. This event does not take into account the enabled
 * state of the entity or any of its ancestors.
 *
 * @event
 * @example
 * entity.zone.on('disable', () => {
 *     console.log(`Zone component of entity '${entity.name}' has been disabled`);
 * });
 */
ZoneComponent.EVENT_DISABLE = 'disable';
/**
 * Fired when the enabled state of the zone component changes. This event does not take into
 * account the enabled state of the entity or any of its ancestors.
 *
 * @event
 * @example
 * entity.zone.on('state', (enabled) => {
 *     console.log(`Zone component of entity '${entity.name}' has been ${enabled ? 'enabled' : 'disabled'}`);
 * });
 */
ZoneComponent.EVENT_STATE = 'state';
/**
 * Fired when a zone component is removed from an entity.
 *
 * @event
 * @example
 * entity.zone.on('remove', () => {
 *     console.log(`Zone component removed from entity '${entity.name}'`);
 * });
 */
ZoneComponent.EVENT_REMOVE = 'remove';

export { ZoneComponent };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcG9uZW50LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbXBvbmVudHMvem9uZS9jb21wb25lbnQuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgVmVjMyB9IGZyb20gJy4uLy4uLy4uL2NvcmUvbWF0aC92ZWMzLmpzJztcblxuaW1wb3J0IHsgQ29tcG9uZW50IH0gZnJvbSAnLi4vY29tcG9uZW50LmpzJztcblxuLyoqXG4gKiBUaGUgWm9uZUNvbXBvbmVudCBhbGxvd3MgeW91IHRvIGRlZmluZSBhbiBhcmVhIGluIHdvcmxkIHNwYWNlIG9mIGNlcnRhaW4gc2l6ZS4gVGhpcyBjYW4gYmUgdXNlZFxuICogaW4gdmFyaW91cyB3YXlzLCBzdWNoIGFzIGFmZmVjdGluZyBhdWRpbyByZXZlcmIgd2hlbiB7QGxpbmsgQXVkaW9MaXN0ZW5lckNvbXBvbmVudH0gaXMgd2l0aGluXG4gKiB6b25lLiBPciBjcmVhdGUgY3VsbGluZyBzeXN0ZW0gd2l0aCBwb3J0YWxzIGJldHdlZW4gem9uZXMgdG8gaGlkZSB3aG9sZSBpbmRvb3Igc2VjdGlvbnMgZm9yXG4gKiBwZXJmb3JtYW5jZSByZWFzb25zLiBBbmQgbWFueSBvdGhlciBwb3NzaWJsZSBvcHRpb25zLiBab25lcyBhcmUgYnVpbGRpbmcgYmxvY2tzIGFuZCBtZWFudCB0byBiZVxuICogdXNlZCBpbiBtYW55IGRpZmZlcmVudCB3YXlzLlxuICpcbiAqIEBhdWdtZW50cyBDb21wb25lbnRcbiAqIEBpZ25vcmVcbiAqL1xuY2xhc3MgWm9uZUNvbXBvbmVudCBleHRlbmRzIENvbXBvbmVudCB7XG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiB0aGUgem9uZSBjb21wb25lbnQgaXMgZW5hYmxlZC4gVGhpcyBldmVudCBkb2VzIG5vdCB0YWtlIGludG8gYWNjb3VudCB0aGUgZW5hYmxlZFxuICAgICAqIHN0YXRlIG9mIHRoZSBlbnRpdHkgb3IgYW55IG9mIGl0cyBhbmNlc3RvcnMuXG4gICAgICpcbiAgICAgKiBAZXZlbnRcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGVudGl0eS56b25lLm9uKCdlbmFibGUnLCAoKSA9PiB7XG4gICAgICogICAgIGNvbnNvbGUubG9nKGBab25lIGNvbXBvbmVudCBvZiBlbnRpdHkgJyR7ZW50aXR5Lm5hbWV9JyBoYXMgYmVlbiBlbmFibGVkYCk7XG4gICAgICogfSk7XG4gICAgICovXG4gICAgc3RhdGljIEVWRU5UX0VOQUJMRSA9ICdlbmFibGUnO1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiB0aGUgem9uZSBjb21wb25lbnQgaXMgZGlzYWJsZWQuIFRoaXMgZXZlbnQgZG9lcyBub3QgdGFrZSBpbnRvIGFjY291bnQgdGhlIGVuYWJsZWRcbiAgICAgKiBzdGF0ZSBvZiB0aGUgZW50aXR5IG9yIGFueSBvZiBpdHMgYW5jZXN0b3JzLlxuICAgICAqXG4gICAgICogQGV2ZW50XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBlbnRpdHkuem9uZS5vbignZGlzYWJsZScsICgpID0+IHtcbiAgICAgKiAgICAgY29uc29sZS5sb2coYFpvbmUgY29tcG9uZW50IG9mIGVudGl0eSAnJHtlbnRpdHkubmFtZX0nIGhhcyBiZWVuIGRpc2FibGVkYCk7XG4gICAgICogfSk7XG4gICAgICovXG4gICAgc3RhdGljIEVWRU5UX0RJU0FCTEUgPSAnZGlzYWJsZSc7XG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIHRoZSBlbmFibGVkIHN0YXRlIG9mIHRoZSB6b25lIGNvbXBvbmVudCBjaGFuZ2VzLiBUaGlzIGV2ZW50IGRvZXMgbm90IHRha2UgaW50b1xuICAgICAqIGFjY291bnQgdGhlIGVuYWJsZWQgc3RhdGUgb2YgdGhlIGVudGl0eSBvciBhbnkgb2YgaXRzIGFuY2VzdG9ycy5cbiAgICAgKlxuICAgICAqIEBldmVudFxuICAgICAqIEBleGFtcGxlXG4gICAgICogZW50aXR5LnpvbmUub24oJ3N0YXRlJywgKGVuYWJsZWQpID0+IHtcbiAgICAgKiAgICAgY29uc29sZS5sb2coYFpvbmUgY29tcG9uZW50IG9mIGVudGl0eSAnJHtlbnRpdHkubmFtZX0nIGhhcyBiZWVuICR7ZW5hYmxlZCA/ICdlbmFibGVkJyA6ICdkaXNhYmxlZCd9YCk7XG4gICAgICogfSk7XG4gICAgICovXG4gICAgc3RhdGljIEVWRU5UX1NUQVRFID0gJ3N0YXRlJztcblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gYSB6b25lIGNvbXBvbmVudCBpcyByZW1vdmVkIGZyb20gYW4gZW50aXR5LlxuICAgICAqXG4gICAgICogQGV2ZW50XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBlbnRpdHkuem9uZS5vbigncmVtb3ZlJywgKCkgPT4ge1xuICAgICAqICAgICBjb25zb2xlLmxvZyhgWm9uZSBjb21wb25lbnQgcmVtb3ZlZCBmcm9tIGVudGl0eSAnJHtlbnRpdHkubmFtZX0nYCk7XG4gICAgICogfSk7XG4gICAgICovXG4gICAgc3RhdGljIEVWRU5UX1JFTU9WRSA9ICdyZW1vdmUnO1xuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IFpvbmVDb21wb25lbnQgaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi9zeXN0ZW0uanMnKS5ab25lQ29tcG9uZW50U3lzdGVtfSBzeXN0ZW0gLSBUaGUgQ29tcG9uZW50U3lzdGVtIHRoYXRcbiAgICAgKiBjcmVhdGVkIHRoaXMgQ29tcG9uZW50LlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi9lbnRpdHkuanMnKS5FbnRpdHl9IGVudGl0eSAtIFRoZSBFbnRpdHkgdGhhdCB0aGlzIENvbXBvbmVudCBpc1xuICAgICAqIGF0dGFjaGVkIHRvLlxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKHN5c3RlbSwgZW50aXR5KSB7XG4gICAgICAgIHN1cGVyKHN5c3RlbSwgZW50aXR5KTtcblxuICAgICAgICB0aGlzLl9vbGRTdGF0ZSA9IHRydWU7XG4gICAgICAgIHRoaXMuX3NpemUgPSBuZXcgVmVjMygpO1xuICAgICAgICB0aGlzLm9uKCdzZXRfZW5hYmxlZCcsIHRoaXMuX29uU2V0RW5hYmxlZCwgdGhpcyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIHNpemUgb2YgdGhlIGF4aXMtYWxpZ25lZCBib3ggb2YgdGhpcyBab25lQ29tcG9uZW50LlxuICAgICAqXG4gICAgICogQHR5cGUge1ZlYzN9XG4gICAgICovXG4gICAgc2V0IHNpemUoZGF0YSkge1xuICAgICAgICBpZiAoZGF0YSBpbnN0YW5jZW9mIFZlYzMpIHtcbiAgICAgICAgICAgIHRoaXMuX3NpemUuY29weShkYXRhKTtcbiAgICAgICAgfSBlbHNlIGlmIChkYXRhIGluc3RhbmNlb2YgQXJyYXkgJiYgZGF0YS5sZW5ndGggPj0gMykge1xuICAgICAgICAgICAgdGhpcy5zaXplLnNldChkYXRhWzBdLCBkYXRhWzFdLCBkYXRhWzJdKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBzaXplKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fc2l6ZTtcbiAgICB9XG5cbiAgICBvbkVuYWJsZSgpIHtcbiAgICAgICAgdGhpcy5fY2hlY2tTdGF0ZSgpO1xuICAgIH1cblxuICAgIG9uRGlzYWJsZSgpIHtcbiAgICAgICAgdGhpcy5fY2hlY2tTdGF0ZSgpO1xuICAgIH1cblxuICAgIF9vblNldEVuYWJsZWQocHJvcCwgb2xkLCB2YWx1ZSkge1xuICAgICAgICB0aGlzLl9jaGVja1N0YXRlKCk7XG4gICAgfVxuXG4gICAgX2NoZWNrU3RhdGUoKSB7XG4gICAgICAgIGNvbnN0IHN0YXRlID0gdGhpcy5lbmFibGVkICYmIHRoaXMuZW50aXR5LmVuYWJsZWQ7XG4gICAgICAgIGlmIChzdGF0ZSA9PT0gdGhpcy5fb2xkU3RhdGUpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgdGhpcy5fb2xkU3RhdGUgPSBzdGF0ZTtcblxuICAgICAgICB0aGlzLmZpcmUoJ2VuYWJsZScpO1xuICAgICAgICB0aGlzLmZpcmUoJ3N0YXRlJywgdGhpcy5lbmFibGVkKTtcbiAgICB9XG5cbiAgICBfb25CZWZvcmVSZW1vdmUoKSB7XG4gICAgICAgIHRoaXMuZmlyZSgncmVtb3ZlJyk7XG4gICAgfVxufVxuXG5leHBvcnQgeyBab25lQ29tcG9uZW50IH07XG4iXSwibmFtZXMiOlsiWm9uZUNvbXBvbmVudCIsIkNvbXBvbmVudCIsImNvbnN0cnVjdG9yIiwic3lzdGVtIiwiZW50aXR5IiwiX29sZFN0YXRlIiwiX3NpemUiLCJWZWMzIiwib24iLCJfb25TZXRFbmFibGVkIiwic2l6ZSIsImRhdGEiLCJjb3B5IiwiQXJyYXkiLCJsZW5ndGgiLCJzZXQiLCJvbkVuYWJsZSIsIl9jaGVja1N0YXRlIiwib25EaXNhYmxlIiwicHJvcCIsIm9sZCIsInZhbHVlIiwic3RhdGUiLCJlbmFibGVkIiwiZmlyZSIsIl9vbkJlZm9yZVJlbW92ZSIsIkVWRU5UX0VOQUJMRSIsIkVWRU5UX0RJU0FCTEUiLCJFVkVOVF9TVEFURSIsIkVWRU5UX1JFTU9WRSJdLCJtYXBwaW5ncyI6Ijs7O0FBSUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFNQSxhQUFhLFNBQVNDLFNBQVMsQ0FBQztBQWdEbEM7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNJQyxFQUFBQSxXQUFXQSxDQUFDQyxNQUFNLEVBQUVDLE1BQU0sRUFBRTtBQUN4QixJQUFBLEtBQUssQ0FBQ0QsTUFBTSxFQUFFQyxNQUFNLENBQUMsQ0FBQTtJQUVyQixJQUFJLENBQUNDLFNBQVMsR0FBRyxJQUFJLENBQUE7QUFDckIsSUFBQSxJQUFJLENBQUNDLEtBQUssR0FBRyxJQUFJQyxJQUFJLEVBQUUsQ0FBQTtJQUN2QixJQUFJLENBQUNDLEVBQUUsQ0FBQyxhQUFhLEVBQUUsSUFBSSxDQUFDQyxhQUFhLEVBQUUsSUFBSSxDQUFDLENBQUE7QUFDcEQsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0VBQ0ksSUFBSUMsSUFBSUEsQ0FBQ0MsSUFBSSxFQUFFO0lBQ1gsSUFBSUEsSUFBSSxZQUFZSixJQUFJLEVBQUU7QUFDdEIsTUFBQSxJQUFJLENBQUNELEtBQUssQ0FBQ00sSUFBSSxDQUFDRCxJQUFJLENBQUMsQ0FBQTtLQUN4QixNQUFNLElBQUlBLElBQUksWUFBWUUsS0FBSyxJQUFJRixJQUFJLENBQUNHLE1BQU0sSUFBSSxDQUFDLEVBQUU7QUFDbEQsTUFBQSxJQUFJLENBQUNKLElBQUksQ0FBQ0ssR0FBRyxDQUFDSixJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUVBLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRUEsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDNUMsS0FBQTtBQUNKLEdBQUE7RUFFQSxJQUFJRCxJQUFJQSxHQUFHO0lBQ1AsT0FBTyxJQUFJLENBQUNKLEtBQUssQ0FBQTtBQUNyQixHQUFBO0FBRUFVLEVBQUFBLFFBQVFBLEdBQUc7SUFDUCxJQUFJLENBQUNDLFdBQVcsRUFBRSxDQUFBO0FBQ3RCLEdBQUE7QUFFQUMsRUFBQUEsU0FBU0EsR0FBRztJQUNSLElBQUksQ0FBQ0QsV0FBVyxFQUFFLENBQUE7QUFDdEIsR0FBQTtBQUVBUixFQUFBQSxhQUFhQSxDQUFDVSxJQUFJLEVBQUVDLEdBQUcsRUFBRUMsS0FBSyxFQUFFO0lBQzVCLElBQUksQ0FBQ0osV0FBVyxFQUFFLENBQUE7QUFDdEIsR0FBQTtBQUVBQSxFQUFBQSxXQUFXQSxHQUFHO0lBQ1YsTUFBTUssS0FBSyxHQUFHLElBQUksQ0FBQ0MsT0FBTyxJQUFJLElBQUksQ0FBQ25CLE1BQU0sQ0FBQ21CLE9BQU8sQ0FBQTtBQUNqRCxJQUFBLElBQUlELEtBQUssS0FBSyxJQUFJLENBQUNqQixTQUFTLEVBQ3hCLE9BQUE7SUFFSixJQUFJLENBQUNBLFNBQVMsR0FBR2lCLEtBQUssQ0FBQTtBQUV0QixJQUFBLElBQUksQ0FBQ0UsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFBO0lBQ25CLElBQUksQ0FBQ0EsSUFBSSxDQUFDLE9BQU8sRUFBRSxJQUFJLENBQUNELE9BQU8sQ0FBQyxDQUFBO0FBQ3BDLEdBQUE7QUFFQUUsRUFBQUEsZUFBZUEsR0FBRztBQUNkLElBQUEsSUFBSSxDQUFDRCxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUE7QUFDdkIsR0FBQTtBQUNKLENBQUE7QUExR0k7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFWTXhCLGFBQWEsQ0FXUjBCLFlBQVksR0FBRyxRQUFRLENBQUE7QUFFOUI7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUF0Qk0xQixhQUFhLENBdUJSMkIsYUFBYSxHQUFHLFNBQVMsQ0FBQTtBQUVoQztBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQWxDTTNCLGFBQWEsQ0FtQ1I0QixXQUFXLEdBQUcsT0FBTyxDQUFBO0FBRTVCO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQTdDTTVCLGFBQWEsQ0E4Q1I2QixZQUFZLEdBQUcsUUFBUTs7OzsifQ==
