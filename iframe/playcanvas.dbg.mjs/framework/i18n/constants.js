const DEFAULT_LOCALE = 'en-US';

// default locale fallbacks if a specific locale
// was not found. E.g. if the desired locale is en-AS but we
// have en-US and en-GB then pick en-US. If a fallback does not exist either
// then pick the first that satisfies the language.
const DEFAULT_LOCALE_FALLBACKS = {
  'en': 'en-US',
  'es': 'en-ES',
  'zh': 'zh-CN',
  'zh-HK': 'zh-TW',
  'zh-TW': 'zh-HK',
  'zh-MO': 'zh-HK',
  'fr': 'fr-FR',
  'de': 'de-DE',
  'it': 'it-IT',
  'ru': 'ru-RU',
  'ja': 'ja-JP'
};

export { DEFAULT_LOCALE, DEFAULT_LOCALE_FALLBACKS };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29uc3RhbnRzLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2kxOG4vY29uc3RhbnRzLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBjb25zdCBERUZBVUxUX0xPQ0FMRSA9ICdlbi1VUyc7XG5cbi8vIGRlZmF1bHQgbG9jYWxlIGZhbGxiYWNrcyBpZiBhIHNwZWNpZmljIGxvY2FsZVxuLy8gd2FzIG5vdCBmb3VuZC4gRS5nLiBpZiB0aGUgZGVzaXJlZCBsb2NhbGUgaXMgZW4tQVMgYnV0IHdlXG4vLyBoYXZlIGVuLVVTIGFuZCBlbi1HQiB0aGVuIHBpY2sgZW4tVVMuIElmIGEgZmFsbGJhY2sgZG9lcyBub3QgZXhpc3QgZWl0aGVyXG4vLyB0aGVuIHBpY2sgdGhlIGZpcnN0IHRoYXQgc2F0aXNmaWVzIHRoZSBsYW5ndWFnZS5cbmV4cG9ydCBjb25zdCBERUZBVUxUX0xPQ0FMRV9GQUxMQkFDS1MgPSB7XG4gICAgJ2VuJzogJ2VuLVVTJyxcbiAgICAnZXMnOiAnZW4tRVMnLFxuICAgICd6aCc6ICd6aC1DTicsXG4gICAgJ3poLUhLJzogJ3poLVRXJyxcbiAgICAnemgtVFcnOiAnemgtSEsnLFxuICAgICd6aC1NTyc6ICd6aC1ISycsXG4gICAgJ2ZyJzogJ2ZyLUZSJyxcbiAgICAnZGUnOiAnZGUtREUnLFxuICAgICdpdCc6ICdpdC1JVCcsXG4gICAgJ3J1JzogJ3J1LVJVJyxcbiAgICAnamEnOiAnamEtSlAnXG59O1xuIl0sIm5hbWVzIjpbIkRFRkFVTFRfTE9DQUxFIiwiREVGQVVMVF9MT0NBTEVfRkFMTEJBQ0tTIl0sIm1hcHBpbmdzIjoiQUFBTyxNQUFNQSxjQUFjLEdBQUcsUUFBTzs7QUFFckM7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyx3QkFBd0IsR0FBRztBQUNwQyxFQUFBLElBQUksRUFBRSxPQUFPO0FBQ2IsRUFBQSxJQUFJLEVBQUUsT0FBTztBQUNiLEVBQUEsSUFBSSxFQUFFLE9BQU87QUFDYixFQUFBLE9BQU8sRUFBRSxPQUFPO0FBQ2hCLEVBQUEsT0FBTyxFQUFFLE9BQU87QUFDaEIsRUFBQSxPQUFPLEVBQUUsT0FBTztBQUNoQixFQUFBLElBQUksRUFBRSxPQUFPO0FBQ2IsRUFBQSxJQUFJLEVBQUUsT0FBTztBQUNiLEVBQUEsSUFBSSxFQUFFLE9BQU87QUFDYixFQUFBLElBQUksRUFBRSxPQUFPO0FBQ2IsRUFBQSxJQUFJLEVBQUUsT0FBQTtBQUNWOzs7OyJ9
