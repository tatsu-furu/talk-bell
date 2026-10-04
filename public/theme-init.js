/* 画面が描かれる前に，保存された明るさ（なければ端末の設定）を適用する */
(function () {
  var t = null;
  try { t = localStorage.getItem('talk-bell.theme'); } catch (e) {}
  if (t !== 'light' && t !== 'dark') t = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', t);
})();
