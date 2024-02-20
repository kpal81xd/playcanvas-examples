class TagsCache {
  constructor(key = null) {
    this._index = {};
    this._key = void 0;
    this._key = key;
  }
  addItem(item) {
    const tags = item.tags._list;
    for (const tag of tags) this.add(tag, item);
  }
  removeItem(item) {
    const tags = item.tags._list;
    for (const tag of tags) this.remove(tag, item);
  }
  add(tag, item) {
    // already in cache
    if (this._index[tag] && this._index[tag].list.indexOf(item) !== -1) return;

    // create index for tag
    if (!this._index[tag]) {
      this._index[tag] = {
        list: []
      };
      // key indexing is available
      if (this._key) this._index[tag].keys = {};
    }

    // add to index list
    this._index[tag].list.push(item);

    // add to index keys
    if (this._key) this._index[tag].keys[item[this._key]] = item;
  }
  remove(tag, item) {
    // no index created for that tag
    if (!this._index[tag]) return;

    // check if item not in cache
    if (this._key) {
      // by key
      if (!this._index[tag].keys[item[this._key]]) return;
    }

    // by position in list
    const ind = this._index[tag].list.indexOf(item);
    if (ind === -1) return;

    // remove item from index list
    this._index[tag].list.splice(ind, 1);

    // remove item from index keys
    if (this._key) delete this._index[tag].keys[item[this._key]];

    // if index empty, remove it
    if (this._index[tag].list.length === 0) delete this._index[tag];
  }
  find(args) {
    const index = {};
    const items = [];
    let item, tag, tags, tagsRest, missingIndex;
    const sort = (a, b) => {
      return this._index[a].list.length - this._index[b].list.length;
    };
    for (let i = 0; i < args.length; i++) {
      tag = args[i];
      if (tag instanceof Array) {
        if (tag.length === 0) continue;
        if (tag.length === 1) {
          tag = tag[0];
        } else {
          // check if all indexes are in present
          missingIndex = false;
          for (let t = 0; t < tag.length; t++) {
            if (!this._index[tag[t]]) {
              missingIndex = true;
              break;
            }
          }
          if (missingIndex) continue;

          // sort tags by least number of matches first
          tags = tag.slice(0).sort(sort);

          // remainder of tags for `has` checks
          tagsRest = tags.slice(1);
          if (tagsRest.length === 1) tagsRest = tagsRest[0];
          for (let n = 0; n < this._index[tags[0]].list.length; n++) {
            item = this._index[tags[0]].list[n];
            if ((this._key ? !index[item[this._key]] : items.indexOf(item) === -1) && item.tags.has(tagsRest)) {
              if (this._key) index[item[this._key]] = true;
              items.push(item);
            }
          }
          continue;
        }
      }
      if (tag && typeof tag === 'string' && this._index[tag]) {
        for (let n = 0; n < this._index[tag].list.length; n++) {
          item = this._index[tag].list[n];
          if (this._key) {
            if (!index[item[this._key]]) {
              index[item[this._key]] = true;
              items.push(item);
            }
          } else if (items.indexOf(item) === -1) {
            items.push(item);
          }
        }
      }
    }
    return items;
  }
}

export { TagsCache };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGFncy1jYWNoZS5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vc3JjL2NvcmUvdGFncy1jYWNoZS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJjbGFzcyBUYWdzQ2FjaGUge1xuICAgIF9pbmRleCA9IHt9O1xuXG4gICAgX2tleTtcblxuICAgIGNvbnN0cnVjdG9yKGtleSA9IG51bGwpIHtcbiAgICAgICAgdGhpcy5fa2V5ID0ga2V5O1xuICAgIH1cblxuICAgIGFkZEl0ZW0oaXRlbSkge1xuICAgICAgICBjb25zdCB0YWdzID0gaXRlbS50YWdzLl9saXN0O1xuXG4gICAgICAgIGZvciAoY29uc3QgdGFnIG9mIHRhZ3MpXG4gICAgICAgICAgICB0aGlzLmFkZCh0YWcsIGl0ZW0pO1xuICAgIH1cblxuICAgIHJlbW92ZUl0ZW0oaXRlbSkge1xuICAgICAgICBjb25zdCB0YWdzID0gaXRlbS50YWdzLl9saXN0O1xuXG4gICAgICAgIGZvciAoY29uc3QgdGFnIG9mIHRhZ3MpXG4gICAgICAgICAgICB0aGlzLnJlbW92ZSh0YWcsIGl0ZW0pO1xuICAgIH1cblxuICAgIGFkZCh0YWcsIGl0ZW0pIHtcbiAgICAgICAgLy8gYWxyZWFkeSBpbiBjYWNoZVxuICAgICAgICBpZiAodGhpcy5faW5kZXhbdGFnXSAmJiB0aGlzLl9pbmRleFt0YWddLmxpc3QuaW5kZXhPZihpdGVtKSAhPT0gLTEpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgLy8gY3JlYXRlIGluZGV4IGZvciB0YWdcbiAgICAgICAgaWYgKCF0aGlzLl9pbmRleFt0YWddKSB7XG4gICAgICAgICAgICB0aGlzLl9pbmRleFt0YWddID0ge1xuICAgICAgICAgICAgICAgIGxpc3Q6IFtdXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgLy8ga2V5IGluZGV4aW5nIGlzIGF2YWlsYWJsZVxuICAgICAgICAgICAgaWYgKHRoaXMuX2tleSlcbiAgICAgICAgICAgICAgICB0aGlzLl9pbmRleFt0YWddLmtleXMgPSB7IH07XG4gICAgICAgIH1cblxuICAgICAgICAvLyBhZGQgdG8gaW5kZXggbGlzdFxuICAgICAgICB0aGlzLl9pbmRleFt0YWddLmxpc3QucHVzaChpdGVtKTtcblxuICAgICAgICAvLyBhZGQgdG8gaW5kZXgga2V5c1xuICAgICAgICBpZiAodGhpcy5fa2V5KVxuICAgICAgICAgICAgdGhpcy5faW5kZXhbdGFnXS5rZXlzW2l0ZW1bdGhpcy5fa2V5XV0gPSBpdGVtO1xuICAgIH1cblxuICAgIHJlbW92ZSh0YWcsIGl0ZW0pIHtcbiAgICAgICAgLy8gbm8gaW5kZXggY3JlYXRlZCBmb3IgdGhhdCB0YWdcbiAgICAgICAgaWYgKCF0aGlzLl9pbmRleFt0YWddKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIC8vIGNoZWNrIGlmIGl0ZW0gbm90IGluIGNhY2hlXG4gICAgICAgIGlmICh0aGlzLl9rZXkpIHtcbiAgICAgICAgICAgIC8vIGJ5IGtleVxuICAgICAgICAgICAgaWYgKCF0aGlzLl9pbmRleFt0YWddLmtleXNbaXRlbVt0aGlzLl9rZXldXSlcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICAvLyBieSBwb3NpdGlvbiBpbiBsaXN0XG4gICAgICAgIGNvbnN0IGluZCA9IHRoaXMuX2luZGV4W3RhZ10ubGlzdC5pbmRleE9mKGl0ZW0pO1xuICAgICAgICBpZiAoaW5kID09PSAtMSlcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICAvLyByZW1vdmUgaXRlbSBmcm9tIGluZGV4IGxpc3RcbiAgICAgICAgdGhpcy5faW5kZXhbdGFnXS5saXN0LnNwbGljZShpbmQsIDEpO1xuXG4gICAgICAgIC8vIHJlbW92ZSBpdGVtIGZyb20gaW5kZXgga2V5c1xuICAgICAgICBpZiAodGhpcy5fa2V5KVxuICAgICAgICAgICAgZGVsZXRlIHRoaXMuX2luZGV4W3RhZ10ua2V5c1tpdGVtW3RoaXMuX2tleV1dO1xuXG4gICAgICAgIC8vIGlmIGluZGV4IGVtcHR5LCByZW1vdmUgaXRcbiAgICAgICAgaWYgKHRoaXMuX2luZGV4W3RhZ10ubGlzdC5sZW5ndGggPT09IDApXG4gICAgICAgICAgICBkZWxldGUgdGhpcy5faW5kZXhbdGFnXTtcbiAgICB9XG5cbiAgICBmaW5kKGFyZ3MpIHtcbiAgICAgICAgY29uc3QgaW5kZXggPSB7IH07XG4gICAgICAgIGNvbnN0IGl0ZW1zID0gW107XG4gICAgICAgIGxldCBpdGVtLCB0YWcsIHRhZ3MsIHRhZ3NSZXN0LCBtaXNzaW5nSW5kZXg7XG5cbiAgICAgICAgY29uc3Qgc29ydCA9IChhLCBiKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5faW5kZXhbYV0ubGlzdC5sZW5ndGggLSB0aGlzLl9pbmRleFtiXS5saXN0Lmxlbmd0aDtcbiAgICAgICAgfTtcblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGFyZ3MubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHRhZyA9IGFyZ3NbaV07XG5cbiAgICAgICAgICAgIGlmICh0YWcgaW5zdGFuY2VvZiBBcnJheSkge1xuICAgICAgICAgICAgICAgIGlmICh0YWcubGVuZ3RoID09PSAwKVxuICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcblxuICAgICAgICAgICAgICAgIGlmICh0YWcubGVuZ3RoID09PSAxKSB7XG4gICAgICAgICAgICAgICAgICAgIHRhZyA9IHRhZ1swXTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAvLyBjaGVjayBpZiBhbGwgaW5kZXhlcyBhcmUgaW4gcHJlc2VudFxuICAgICAgICAgICAgICAgICAgICBtaXNzaW5nSW5kZXggPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgdCA9IDA7IHQgPCB0YWcubGVuZ3RoOyB0KyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghdGhpcy5faW5kZXhbdGFnW3RdXSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1pc3NpbmdJbmRleCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKG1pc3NpbmdJbmRleClcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIHNvcnQgdGFncyBieSBsZWFzdCBudW1iZXIgb2YgbWF0Y2hlcyBmaXJzdFxuICAgICAgICAgICAgICAgICAgICB0YWdzID0gdGFnLnNsaWNlKDApLnNvcnQoc29ydCk7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gcmVtYWluZGVyIG9mIHRhZ3MgZm9yIGBoYXNgIGNoZWNrc1xuICAgICAgICAgICAgICAgICAgICB0YWdzUmVzdCA9IHRhZ3Muc2xpY2UoMSk7XG4gICAgICAgICAgICAgICAgICAgIGlmICh0YWdzUmVzdC5sZW5ndGggPT09IDEpXG4gICAgICAgICAgICAgICAgICAgICAgICB0YWdzUmVzdCA9IHRhZ3NSZXN0WzBdO1xuXG4gICAgICAgICAgICAgICAgICAgIGZvciAobGV0IG4gPSAwOyBuIDwgdGhpcy5faW5kZXhbdGFnc1swXV0ubGlzdC5sZW5ndGg7IG4rKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgaXRlbSA9IHRoaXMuX2luZGV4W3RhZ3NbMF1dLmxpc3Rbbl07XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoKHRoaXMuX2tleSA/ICFpbmRleFtpdGVtW3RoaXMuX2tleV1dIDogKGl0ZW1zLmluZGV4T2YoaXRlbSkgPT09IC0xKSkgJiYgaXRlbS50YWdzLmhhcyh0YWdzUmVzdCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5fa2V5KVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpbmRleFtpdGVtW3RoaXMuX2tleV1dID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpdGVtcy5wdXNoKGl0ZW0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodGFnICYmIHR5cGVvZiB0YWcgPT09ICdzdHJpbmcnICYmIHRoaXMuX2luZGV4W3RhZ10pIHtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBuID0gMDsgbiA8IHRoaXMuX2luZGV4W3RhZ10ubGlzdC5sZW5ndGg7IG4rKykge1xuICAgICAgICAgICAgICAgICAgICBpdGVtID0gdGhpcy5faW5kZXhbdGFnXS5saXN0W25dO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLl9rZXkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghaW5kZXhbaXRlbVt0aGlzLl9rZXldXSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGluZGV4W2l0ZW1bdGhpcy5fa2V5XV0gPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGl0ZW1zLnB1c2goaXRlbSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoaXRlbXMuaW5kZXhPZihpdGVtKSA9PT0gLTEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGl0ZW1zLnB1c2goaXRlbSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gaXRlbXM7XG4gICAgfVxufVxuXG5leHBvcnQgeyBUYWdzQ2FjaGUgfTtcbiJdLCJuYW1lcyI6WyJUYWdzQ2FjaGUiLCJjb25zdHJ1Y3RvciIsImtleSIsIl9pbmRleCIsIl9rZXkiLCJhZGRJdGVtIiwiaXRlbSIsInRhZ3MiLCJfbGlzdCIsInRhZyIsImFkZCIsInJlbW92ZUl0ZW0iLCJyZW1vdmUiLCJsaXN0IiwiaW5kZXhPZiIsImtleXMiLCJwdXNoIiwiaW5kIiwic3BsaWNlIiwibGVuZ3RoIiwiZmluZCIsImFyZ3MiLCJpbmRleCIsIml0ZW1zIiwidGFnc1Jlc3QiLCJtaXNzaW5nSW5kZXgiLCJzb3J0IiwiYSIsImIiLCJpIiwiQXJyYXkiLCJ0Iiwic2xpY2UiLCJuIiwiaGFzIl0sIm1hcHBpbmdzIjoiQUFBQSxNQUFNQSxTQUFTLENBQUM7QUFLWkMsRUFBQUEsV0FBV0EsQ0FBQ0MsR0FBRyxHQUFHLElBQUksRUFBRTtJQUFBLElBSnhCQyxDQUFBQSxNQUFNLEdBQUcsRUFBRSxDQUFBO0FBQUEsSUFBQSxJQUFBLENBRVhDLElBQUksR0FBQSxLQUFBLENBQUEsQ0FBQTtJQUdBLElBQUksQ0FBQ0EsSUFBSSxHQUFHRixHQUFHLENBQUE7QUFDbkIsR0FBQTtFQUVBRyxPQUFPQSxDQUFDQyxJQUFJLEVBQUU7QUFDVixJQUFBLE1BQU1DLElBQUksR0FBR0QsSUFBSSxDQUFDQyxJQUFJLENBQUNDLEtBQUssQ0FBQTtBQUU1QixJQUFBLEtBQUssTUFBTUMsR0FBRyxJQUFJRixJQUFJLEVBQ2xCLElBQUksQ0FBQ0csR0FBRyxDQUFDRCxHQUFHLEVBQUVILElBQUksQ0FBQyxDQUFBO0FBQzNCLEdBQUE7RUFFQUssVUFBVUEsQ0FBQ0wsSUFBSSxFQUFFO0FBQ2IsSUFBQSxNQUFNQyxJQUFJLEdBQUdELElBQUksQ0FBQ0MsSUFBSSxDQUFDQyxLQUFLLENBQUE7QUFFNUIsSUFBQSxLQUFLLE1BQU1DLEdBQUcsSUFBSUYsSUFBSSxFQUNsQixJQUFJLENBQUNLLE1BQU0sQ0FBQ0gsR0FBRyxFQUFFSCxJQUFJLENBQUMsQ0FBQTtBQUM5QixHQUFBO0FBRUFJLEVBQUFBLEdBQUdBLENBQUNELEdBQUcsRUFBRUgsSUFBSSxFQUFFO0FBQ1g7SUFDQSxJQUFJLElBQUksQ0FBQ0gsTUFBTSxDQUFDTSxHQUFHLENBQUMs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