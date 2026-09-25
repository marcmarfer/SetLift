# SetLift

App de gimnasio para planificar tus rutinas, apuntar las series entre descansos y ver si estás
progresando. Pensada para el móvil y para usarse sin cobertura: todo se guarda primero en el
dispositivo y se sincroniza cuando hay red.

## Qué hace

- **Planes y rutinas**: semanales (se reinician cada lunes) o en rotación (avanzan cuando entrenas).
- **Entreno**: apuntas peso y repeticiones con un toque, con temporizador de descanso y sugerencia
  de peso según la última vez.
- **Progreso**: mejor serie, tendencia, 1RM estimado y récords por ejercicio.
- **Catálogo de ejercicios** agrupado por variantes (barra, mancuernas, Smith, máquina…), y los
  tuyos propios si falta alguno.
- **Cuenta** con Google, verificación en dos pasos y sincronización entre dispositivos.

## Stack

Vue 3 + TypeScript + Vite · Tailwind v4 · Pinia · Dexie (IndexedDB) · Supabase · PWA.

## Arrancar

```bash
npm install
cp .env.example .env.local   # y rellena la URL y la anon key de Supabase
npm run dev                  # http://localhost:5173
```

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo. `npm run dev -- --host` para abrirlo desde el móvil |
| `npm run build` | Comprueba los tipos y genera `dist/` |
| `npm run preview` | Sirve el build |

## Estructura

```
src/
  screens/      una pantalla por ruta
  components/   piezas reutilizables (buscador de ejercicios, teclado, descanso…)
  stores/       estado compartido: sesión, ajustes, descanso, deshacer
  lib/          lógica sin interfaz: planes, progreso, sincronización…
  db/           base de datos local (Dexie)
```
