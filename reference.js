/* Log Pose · datos globales de referencia para la pestaña Cruces.
   Fuente: TCG Match Making (partidas ranked de su simulador), publicado en opdecks.xyz/winmatrix.
   Formato OP18, actualizado el 19-11-2026, 10.174 partidas en total. Sin separación 1.º/2.º.
   Fila = líder que juega, columna = rival, valor = % de victorias de la fila.
   Para actualizarlo, cambia DATE y los valores. */
window.LP_REFERENCE = {
  SOURCE: 'TCG Match Making (vía opdecks.xyz)',
  URL: 'https://opdecks.xyz/winmatrix',
  DATE: '2026-11-19',
  FORMAT: 'OP18',
  LEADERS: [
    { code: 'OP17-039', name: 'Rocks.D.Xebec', games: 2549 },
    { code: 'OP18-060', name: 'Saint Gunko', games: 2272 },
    { code: 'OP09-042', name: 'Buggy', games: 1491 },
    { code: 'EB05-010', name: 'Nico Robin', games: 995 },
    { code: 'OP18-041', name: 'Ms. All Sunday', games: 940 },
    { code: 'OP13-001', name: 'Monkey.D.Luffy', games: 832 },
    { code: 'OP17-058', name: 'Kaido', games: 634 },
    { code: 'OP13-004', name: 'Sabo', games: 461 },
  ],
  MATRIX: [
    [null, 47.4, 49.6, 57.8, 60.6, 52.6, 45.5, 56.1],
    [52.6, null, 39.9, 40.4, 45.9, 43.2, 60.0, 53.4],
    [50.4, 60.1, null, 41.8, 76.2, 38.3, 74.6, 56.0],
    [42.2, 59.6, 58.2, null, 34.2, 28.3, 33.9, 51.9],
    [39.4, 54.1, 23.8, 65.8, null, 43.5, 28.6, 25.0],
    [47.4, 56.8, 61.7, 71.7, 56.5, null, 66.7, 81.8],
    [54.5, 40.0, 25.4, 66.1, 71.4, 33.3, null, 64.3],
    [43.9, 46.6, 44.0, 48.1, 75.0, 18.2, 35.7, null],
  ],
};
