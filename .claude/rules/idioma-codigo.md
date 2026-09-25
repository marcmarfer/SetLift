# Idioma: código en inglés, producto en español

## El código, en inglés

Todo lo que se escribe para la máquina va en inglés, sin mezclar:

- Nombres de variables, funciones, clases, tipos e interfaces.
- Nombres de ficheros y de carpetas (`dates.ts`, no `fechas.ts`).
- Componentes Vue (`TabBar.vue`, `Today.vue`).
- Claves de objetos, nombres de tablas e índices, y los valores de las uniones
  de tipos (`'weekly' | 'rotation'`, no `'semanal' | 'rotacion'`).
- Rutas del router (`/history`), parámetros y nombres de rutas.

Nada de espanglish (`sesionId`, `getRutinas`, `datosDeHoy`).

## El producto, en español

Lo que lee el usuario va en español, con sus tildes:

- Textos de la interfaz: títulos, botones, etiquetas, vacíos, errores.
- Los datos de dominio que son contenido, no código: nombres de ejercicios
  ("Peso muerto rumano"), de rutinas ("Legs") y de planes.
- Los textos que genera la app para el usuario (fechas, "hace 6 días").

## Frontera

El punto de traducción es la plantilla. La lógica maneja identificadores en
inglés; el `<template>` es el único sitio donde aparece el español de cara al
usuario. Un valor de dominio como `'failure'` se guarda así y se muestra como
"Al fallo".
