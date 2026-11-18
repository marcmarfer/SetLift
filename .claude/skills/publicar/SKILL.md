---
name: publicar
description: Publica los cambios de SetLift (build, commit en inglés directamente en main, push y despliegue a mano con wrangler y, si toca, de la Edge Function). Úsalo cuando Marc diga «súbelo», «publica», «publícalo» o escriba /publicar.
argument-hint: "[tema del cambio]"
---

# Publicar en main

«Súbelo» es el permiso para todo el flujo de este archivo: no preguntes en cada paso, pero
para y avisa en cuanto algo no cuadre. Los commits salen con la identidad git de la máquina
(`marcmarfer`, la cuenta de Marc), y Marc es el único autor.

En SetLift no hay ramas, worktrees ni PRs: se commitea directamente en `main`, en la carpeta
principal.

## Dónde está cada cosa

|                   | SetLift                                                                 |
| ----------------- | ----------------------------------------------------------------------- |
| Carpeta principal | La raíz del repo (`git rev-parse --show-toplevel`)                      |
| Rama              | `main`                                                                  |
| Web               | Cloudflare Worker `setlift` (`wrangler.jsonc`), https://setlift.es      |
| API               | Edge Function `workouts` en Supabase (ref `odjvqrzpbksgyhskasda`)       |
| Despliegue        | A mano: el push a `main` no despliega nada                              |

Todo git con `git -C <principal> …` y rutas absolutas. Nunca `cd` a la carpeta principal salvo
para `npm run build` y los despliegues, que necesitan el cwd ahí.

## Paso 1: comprobar

1. `git -C <principal> branch --show-current` tiene que ser `main`. Si no, para y avisa.
2. `git -C <principal> status --short`. Sin cambios ni commits pendientes de subir → no hay
   nada que publicar; dilo y para.
3. `git -C <principal> pull origin main`. Si falla o deja conflicto: **para**, no toques nada
   más y dile a Marc qué archivos chocan. No resuelvas conflictos por tu cuenta.
4. `cd <principal> && npm run build` (`vue-tsc -b` y Vite). Si falla, para y avisa.
5. Si el cambio añade campos a una tabla sincronizada, sus columnas tienen que existir ya en
   Supabase: `src/lib/rows.ts` manda cada campo local como columna. Si faltan, para y avisa.

## Paso 2: commit y push

1. `git -C <principal> add -A`
2. `git -C <principal> commit -m "<asunto>"`: en inglés, una línea `[Feat] …` (funcionalidad
   nueva) o `[Fix] …` (corrección) que describa el cambio; el porqué, si aporta, en el cuerpo.
   Sin `Co-Authored-By`, sin `Claude-Session` ni ninguna línea de Claude.
3. `git -C <principal> push -u origin main`. Si falla por red, reintenta hasta 4 veces
   (2 s, 4 s, 8 s, 16 s).

- **Nunca**: PRs, `checkout`, `restore`, `stash`, `reset`, `rebase`, `push --force`, crear o
  borrar ramas.

## Paso 3: desplegar

1. `cd <principal> && npx wrangler deploy`, con el `dist/` del build del paso 1. Apunta el
   Version ID que devuelve.
2. Si el commit toca `supabase/functions/workouts/`, redespliega la Edge Function (sin JWT):
   `npx supabase functions deploy workouts --project-ref odjvqrzpbksgyhskasda --no-verify-jwt`.
   Si la CLI no tiene sesión, no la abras tú: di que hay que redesplegarla desde Supabase.
3. Comprueba que https://setlift.es responde 200.

## Al terminar

Un mensaje corto a Marc: qué se ha publicado (el asunto del commit), el Version ID del
despliegue y lo que haya quedado pendiente. Si existe el skill `/limpiar-ramas`, pásalo al
final para quitar las ramas viejas.
