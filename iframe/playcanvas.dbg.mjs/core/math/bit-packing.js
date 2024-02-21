/**
 * BitPacking API - functionality for operating on values stored as bits in a number.
 *
 * @namespace
 * @ignore
 */
const BitPacking = {
  /**
   * Sets a value to specified bits of a number.
   *
   * @param {number} storage - Number to store the bits into.
   * @param {number} value - Value to store.
   * @param {number} shift - Number of bits to shift the value.
   * @param {number} [mask] - Mask for the value to limit the number of storage bits. Defaults to 1.
   * @returns {number} Returns the storage updated with the value.
   */
  set(storage, value, shift, mask = 1) {
    // clear the space
    const data = storage & ~(mask << shift);

    // set the bits
    return data | value << shift;
  },
  /**
   * Gets the value of specified bits from a number.
   *
   * @param {number} storage - Number to extract the bits from.
   * @param {number} shift - Number of bits to shift the mask.
   * @param {number} [mask] - Mask for the value to limit the number of storage bits. Defaults to 1.
   * @returns {number} Returns the extracted value.
   */
  get(storage, shift, mask = 1) {
    return storage >> shift & mask;
  },
  /**
   * Tests if all specified bits are set.
   *
   * @param {number} storage - Number to test.
   * @param {number} shift - Number of bits to shift the mask.
   * @param {number} [mask] - Mask to limit the number of storage bits. Defaults to 1.
   * @returns {boolean} Returns true if all bits in the mask are set in the storage.
   */
  all(storage, shift, mask = 1) {
    const shifted = mask << shift;
    return (storage & shifted) === shifted;
  },
  /**
   * Tests if any specified bits are set.
   *
   * @param {number} storage - Number to test.
   * @param {number} shift - Number of bits to shift the mask.
   * @param {number} [mask] - Mask to limit the number of storage bits. Defaults to 1.
   * @returns {boolean} Returns true if any bits in the mask are set in the storage.
   */
  any(storage, shift, mask = 1) {
    return (storage & mask << shift) !== 0;
  }
};

export { BitPacking };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYml0LXBhY2tpbmcuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3NyYy9jb3JlL21hdGgvYml0LXBhY2tpbmcuanMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBCaXRQYWNraW5nIEFQSSAtIGZ1bmN0aW9uYWxpdHkgZm9yIG9wZXJhdGluZyBvbiB2YWx1ZXMgc3RvcmVkIGFzIGJpdHMgaW4gYSBudW1iZXIuXG4gKlxuICogQG5hbWVzcGFjZVxuICogQGlnbm9yZVxuICovXG5jb25zdCBCaXRQYWNraW5nID0ge1xuXG4gICAgLyoqXG4gICAgICogU2V0cyBhIHZhbHVlIHRvIHNwZWNpZmllZCBiaXRzIG9mIGEgbnVtYmVyLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHN0b3JhZ2UgLSBOdW1iZXIgdG8gc3RvcmUgdGhlIGJpdHMgaW50by5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gdmFsdWUgLSBWYWx1ZSB0byBzdG9yZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gc2hpZnQgLSBOdW1iZXIgb2YgYml0cyB0byBzaGlmdCB0aGUgdmFsdWUuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFttYXNrXSAtIE1hc2sgZm9yIHRoZSB2YWx1ZSB0byBsaW1pdCB0aGUgbnVtYmVyIG9mIHN0b3JhZ2UgYml0cy4gRGVmYXVsdHMgdG8gMS5cbiAgICAgKiBAcmV0dXJucyB7bnVtYmVyfSBSZXR1cm5zIHRoZSBzdG9yYWdlIHVwZGF0ZWQgd2l0aCB0aGUgdmFsdWUuXG4gICAgICovXG4gICAgc2V0KHN0b3JhZ2UsIHZhbHVlLCBzaGlmdCwgbWFzayA9IDEpIHtcbiAgICAgICAgLy8gY2xlYXIgdGhlIHNwYWNlXG4gICAgICAgIGNvbnN0IGRhdGEgPSBzdG9yYWdlICYgfihtYXNrIDw8IHNoaWZ0KTtcblxuICAgICAgICAvLyBzZXQgdGhlIGJpdHNcbiAgICAgICAgcmV0dXJuIGRhdGEgfCAodmFsdWUgPDwgc2hpZnQpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBHZXRzIHRoZSB2YWx1ZSBvZiBzcGVjaWZpZWQgYml0cyBmcm9tIGEgbnVtYmVyLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHN0b3JhZ2UgLSBOdW1iZXIgdG8gZXh0cmFjdCB0aGUgYml0cyBmcm9tLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBzaGlmdCAtIE51bWJlciBvZiBiaXRzIHRvIHNoaWZ0IHRoZSBtYXNrLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbbWFza10gLSBNYXNrIGZvciB0aGUgdmFsdWUgdG8gbGltaXQgdGhlIG51bWJlciBvZiBzdG9yYWdlIGJpdHMuIERlZmF1bHRzIHRvIDEuXG4gICAgICogQHJldHVybnMge251bWJlcn0gUmV0dXJucyB0aGUgZXh0cmFjdGVkIHZhbHVlLlxuICAgICAqL1xuICAgIGdldChzdG9yYWdlLCBzaGlmdCwgbWFzayA9IDEpIHtcbiAgICAgICAgcmV0dXJuIChzdG9yYWdlID4+IHNoaWZ0KSAmIG1hc2s7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFRlc3RzIGlmIGFsbCBzcGVjaWZpZWQgYml0cyBhcmUgc2V0LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHN0b3JhZ2UgLSBOdW1iZXIgdG8gdGVzdC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gc2hpZnQgLSBOdW1iZXIgb2YgYml0cyB0byBzaGlmdCB0aGUgbWFzay5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW21hc2tdIC0gTWFzayB0byBsaW1pdCB0aGUgbnVtYmVyIG9mIHN0b3JhZ2UgYml0cy4gRGVmYXVsdHMgdG8gMS5cbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyB0cnVlIGlmIGFsbCBiaXRzIGluIHRoZSBtYXNrIGFyZSBzZXQgaW4gdGhlIHN0b3JhZ2UuXG4gICAgICovXG4gICAgYWxsKHN0b3JhZ2UsIHNoaWZ0LCBtYXNrID0gMSkge1xuICAgICAgICBjb25zdCBzaGlmdGVkID0gbWFzayA8PCBzaGlmdDtcbiAgICAgICAgcmV0dXJuIChzdG9yYWdlICYgc2hpZnRlZCkgPT09IHNoaWZ0ZWQ7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFRlc3RzIGlmIGFueSBzcGVjaWZpZWQgYml0cyBhcmUgc2V0LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHN0b3JhZ2UgLSBOdW1iZXIgdG8gdGVzdC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gc2hpZnQgLSBOdW1iZXIgb2YgYml0cyB0byBzaGlmdCB0aGUgbWFzay5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW21hc2tdIC0gTWFzayB0byBsaW1pdCB0aGUgbnVtYmVyIG9mIHN0b3JhZ2UgYml0cy4gRGVmYXVsdHMgdG8gMS5cbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyB0cnVlIGlmIGFueSBiaXRzIGluIHRoZSBtYXNrIGFyZSBzZXQgaW4gdGhlIHN0b3JhZ2UuXG4gICAgICovXG4gICAgYW55KHN0b3JhZ2UsIHNoaWZ0LCBtYXNrID0gMSkge1xuICAgICAgICByZXR1cm4gKHN0b3JhZ2UgJiAobWFzayA8PCBzaGlmdCkpICE9PSAwO1xuICAgIH1cbn07XG5cbmV4cG9ydCB7IEJpdFBhY2tpbmcgfTtcbiJdLCJuYW1lcyI6WyJCaXRQYWNraW5nIiwic2V0Iiwic3RvcmFnZSIsInZhbHVlIiwic2hpZnQiLCJtYXNrIiwiZGF0YSIsImdldCIsImFsbCIsInNoaWZ0ZWQiLCJhbnkiXSwibWFwcGluZ3MiOiJBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQU1BLFVBQVUsR0FBRztBQUVmO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNJQyxHQUFHQSxDQUFDQyxPQUFPLEVBQUVDLEtBQUssRUFBRUMsS0FBSyxFQUFFQyxJQUFJLEdBQUcsQ0FBQyxFQUFFO0FBQ2pDO0lBQ0EsTUFBTUMsSUFBSSxHQUFHSixPQUFPLEdBQUcsRUFBRUcsSUFBSSxJQUFJRCxLQUFLLENBQUMsQ0FBQTs7QUFFdkM7QUFDQSxJQUFBLE9BQU9FLElBQUksR0FBSUgsS0FBSyxJQUFJQyxLQUFNLENBQUE7R0FDakM7QUFFRDtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0lHLEdBQUdBLENBQUNMLE9BQU8sRUFBRUUsS0FBSyxFQUFFQyxJQUFJLEdBQUcsQ0FBQyxFQUFFO0FBQzFCLElBQUEsT0FBUUgsT0FBTyxJQUFJRSxLQUFLLEdBQUlDLElBQUksQ0FBQTtHQUNuQztBQUVEO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDSUcsR0FBR0EsQ0FBQ04sT0FBTyxFQUFFRSxLQUFLLEVBQUVDLElBQUksR0FBRyxDQUFDLEVBQUU7QUFDMUIsSUFBQSxNQUFNSSxPQUFPLEdBQUdKLElBQUksSUFBSUQsS0FBSyxDQUFBO0FBQzdCLElBQUEsT0FBTyxDQUFDRixPQUFPLEdBQUdPLE9BQU8sTUFBTUEsT0FBTyxDQUFBO0dBQ3pDO0FBRUQ7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNJQyxHQUFHQSxDQUFDUixPQUFPLEVBQUVFLEtBQUssRUFBRUMsSUFBSSxHQUFHLENBQUMsRUFBRTtBQUMxQixJQUFBLE9BQU8sQ0FBQ0gsT0FBTyxHQUFJRyxJQUFJLElBQUlELEtBQU0sTUFBTSxDQUFDLENBQUE7QUFDNUMsR0FBQTtBQUNKOzs7OyJ9
