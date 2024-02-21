/**
 * Wraps a set of data used in animation.
 *
 * @category Animation
 */
class AnimData {
  /**
   * Create a new animation AnimData instance.
   *
   * @param {number} components - Specifies how many components make up an element of data. For
   * example, specify 3 for a set of 3-dimensional vectors. The number of elements in data array
   * must be a multiple of components.
   * @param {Float32Array|number[]} data - The set of data.
   */
  constructor(components, data) {
    this._components = components;
    this._data = data;
  }

  /**
   * Gets the number of components that make up an element.
   *
   * @type {number}
   */
  get components() {
    return this._components;
  }

  /**
   * Gets the data.
   *
   * @type {Float32Array|number[]}
   */
  get data() {
    return this._data;
  }
}

export { AnimData };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYW5pbS1kYXRhLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2FuaW0vZXZhbHVhdG9yL2FuaW0tZGF0YS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIFdyYXBzIGEgc2V0IG9mIGRhdGEgdXNlZCBpbiBhbmltYXRpb24uXG4gKlxuICogQGNhdGVnb3J5IEFuaW1hdGlvblxuICovXG5jbGFzcyBBbmltRGF0YSB7XG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IGFuaW1hdGlvbiBBbmltRGF0YSBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBjb21wb25lbnRzIC0gU3BlY2lmaWVzIGhvdyBtYW55IGNvbXBvbmVudHMgbWFrZSB1cCBhbiBlbGVtZW50IG9mIGRhdGEuIEZvclxuICAgICAqIGV4YW1wbGUsIHNwZWNpZnkgMyBmb3IgYSBzZXQgb2YgMy1kaW1lbnNpb25hbCB2ZWN0b3JzLiBUaGUgbnVtYmVyIG9mIGVsZW1lbnRzIGluIGRhdGEgYXJyYXlcbiAgICAgKiBtdXN0IGJlIGEgbXVsdGlwbGUgb2YgY29tcG9uZW50cy5cbiAgICAgKiBAcGFyYW0ge0Zsb2F0MzJBcnJheXxudW1iZXJbXX0gZGF0YSAtIFRoZSBzZXQgb2YgZGF0YS5cbiAgICAgKi9cbiAgICBjb25zdHJ1Y3Rvcihjb21wb25lbnRzLCBkYXRhKSB7XG4gICAgICAgIHRoaXMuX2NvbXBvbmVudHMgPSBjb21wb25lbnRzO1xuICAgICAgICB0aGlzLl9kYXRhID0gZGF0YTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXRzIHRoZSBudW1iZXIgb2YgY29tcG9uZW50cyB0aGF0IG1ha2UgdXAgYW4gZWxlbWVudC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgZ2V0IGNvbXBvbmVudHMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jb21wb25lbnRzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldHMgdGhlIGRhdGEuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7RmxvYXQzMkFycmF5fG51bWJlcltdfVxuICAgICAqL1xuICAgIGdldCBkYXRhKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZGF0YTtcbiAgICB9XG59XG5cbmV4cG9ydCB7IEFuaW1EYXRhIH07XG4iXSwibmFtZXMiOlsiQW5pbURhdGEiLCJjb25zdHJ1Y3RvciIsImNvbXBvbmVudHMiLCJkYXRhIiwiX2NvbXBvbmVudHMiLCJfZGF0YSJdLCJtYXBwaW5ncyI6IkFBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQU1BLFFBQVEsQ0FBQztBQUNYO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDSUMsRUFBQUEsV0FBV0EsQ0FBQ0MsVUFBVSxFQUFFQyxJQUFJLEVBQUU7SUFDMUIsSUFBSSxDQUFDQyxXQUFXLEdBQUdGLFVBQVUsQ0FBQTtJQUM3QixJQUFJLENBQUNHLEtBQUssR0FBR0YsSUFBSSxDQUFBO0FBQ3JCLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtFQUNJLElBQUlELFVBQVVBLEdBQUc7SUFDYixPQUFPLElBQUksQ0FBQ0UsV0FBVyxDQUFBO0FBQzNCLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtFQUNJLElBQUlELElBQUlBLEdBQUc7SUFDUCxPQUFPLElBQUksQ0FBQ0UsS0FBSyxDQUFBO0FBQ3JCLEdBQUE7QUFDSjs7OzsifQ==