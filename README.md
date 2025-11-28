# TimeFace EasyShift - Sistema de Control de Asistencia Inteligente

TimeFace EasyShift es un sistema avanzado de control de asistencia y planificación de turnos. Utiliza reconocimiento facial a través de la API de Gemini para garantizar un registro de entrada/salida preciso, seguro y sin contacto, ideal para cualquier entorno laboral.

## ✨ Características Principales

-   **Registro por Reconocimiento Facial:** Captura y validación biométrica en tiempo real para marcar la asistencia.
-   **Gestión de Colaboradores:** Administra fácilmente la información y fotos de referencia de tu personal.
-   **Planificación de Turnos Avanzada:** Asigna turnos manualmente o utiliza patrones rotativos para generar horarios complejos en segundos.
-   **Generación Automática de Horarios:** Aplica patrones de trabajo (ej. 2x2x2, 4x3) a múltiples colaboradores para un período determinado con un solo clic.
-   **Administración Centralizada:** Gestiona turnos, patrones, usuarios del sistema y roles desde un único panel.
-   **Reportes Detallados:** Obtén informes de horas trabajadas, horas programadas y horas extra por colaborador y rangos de fecha.
-   **Interfaz Moderna y Adaptable:** Diseño limpio y fácil de usar, compatible con temas claro y oscuro.

---

## 📚 Guía de Usuario

Esta guía te llevará paso a paso a través de la configuración y el uso de TimeFace EasyShift.

### 1. Configuración Inicial (Panel de Administración)

Para que el sistema funcione correctamente, primero debes configurar los elementos básicos en el módulo de **Administración**.

#### a. Gestionar Turnos

Los turnos son los bloques fundamentales de cualquier horario.

1.  Ve a **Administración > Gestionar Turnos**.
2.  Haz clic en **"Agregar Turno"**.
3.  Define las propiedades del turno:
    *   **Nombre:** Un identificador claro (ej. "Turno Mañana", "Turno Noche").
    *   **Hora de Inicio y Fin:** El horario que cubre el turno (ej. 06:00 a 14:00).
    *   **Color:** Elige un color distintivo que ayudará a identificarlo visualmente en el calendario de planificación.
4.  Crea todos los turnos que tu operación requiera (Mañana, Tarde, Noche, etc.).

#### b. Gestionar Patrones de Turnos

Los patrones son secuencias predefinidas de turnos y días de descanso que se repiten cíclicamente. Son la clave para la automatización.

**Ejemplo: ¿Cómo funciona el patrón rotativo 2x2x2?**

Este es un patrón común para operaciones 24/7. Describe una secuencia donde un empleado trabaja:
-   **2** días de **Mañana**.
-   **2** días de **Tarde**.
-   **2** días de **Noche**.
-   Seguidos de un número de días de **Descanso** (ej. 3 días de descanso).

El ciclo completo sería: `Mañana, Mañana, Tarde, Tarde, Noche, Noche, Descanso, Descanso, Descanso`. Luego, la secuencia vuelve a empezar.

**Para crear este patrón en el sistema:**

1.  Ve a **Administración > Gestionar Patrones**.
2.  Haz clic en **"Crear Patrón"**.
3.  **Nombre:** Asígnale un nombre descriptivo, como "Rotativo 2x2x2 (3 Descansos)".
4.  **Arma la Secuencia:** En la sección "Agregar a la secuencia", haz clic en los botones de los turnos y descansos en el orden correcto. Por cada clic, se añadirá un elemento a la secuencia.
    *   Clic en "Turno Mañana" (x2)
    *   Clic en "Turno Tarde" (x2)
    *   Clic en "Turno Noche" (x2)
    *   Clic en "Descanso" (x3)
5.  Haz clic en **"Guardar Patrón"**.

#### c. Gestionar Colaboradores

Aquí es donde registras a tu personal y sus fotos para el reconocimiento facial.

1.  Ve al módulo de **Colaboradores**.
2.  Haz clic en **"Agregar Colaborador"**.
3.  Completa los campos:
    *   **Nombre Completo**.
    *   **Cargo**.
    *   **Foto de Referencia:** Tienes dos opciones:
        *   **Usar Cámara:** Activa la cámara para capturar una foto clara del rostro del colaborador en el momento.
        *   **Subir Archivo:** Sube una foto de alta calidad donde el rostro sea claramente visible.
4.  Guarda los cambios. Repite el proceso para todo tu personal.

### 2. Creación de Horarios (Módulo de Planificación)

Una vez configurado todo, ya puedes generar los horarios de trabajo.

#### a. Generación Automática (Recomendado)

Esta es la función más potente del sistema.

1.  Ve al módulo de **Planificación**.
2.  Haz clic en el botón verde **"Generar Automático"**. Se abrirá una ventana.
3.  **Selecciona el Patrón:** Elige el patrón que creaste (ej. "Rotativo 2x2x2").
4.  **Define el Período:** Selecciona la **Fecha de Inicio** y **Fecha de Fin** para las cuales quieres generar el horario (ej. del 1 al 31 del próximo mes).
5.  **Elige a los Colaboradores:** Marca las casillas de todos los colaboradores a los que se les aplicará este patrón.
6.  Haz clic en **"Generar Horario"**.

El sistema llenará automáticamente el calendario para el período y los colaboradores seleccionados, asignando los turnos y descansos según la secuencia del patrón.

#### b. Asignación Manual

Si necesitas hacer un ajuste puntual o asignar un turno específico:

1.  En la vista de **Planificación**, busca la celda correspondiente a un colaborador y una fecha.
2.  Pasa el cursor sobre la celda. Aparecerá un menú con todos los turnos disponibles.
3.  Haz clic en el turno que deseas asignar. El cambio se guardará automáticamente.

### 3. Registro de Asistencia (Módulo de Asistencia)

Este es el módulo de uso diario para registrar entradas y salidas.

1.  Ve al módulo de **Asistencia**. La cámara se activará automáticamente.
2.  El colaborador debe posicionar su rostro de manera clara frente a la cámara.
3.  Haz clic en **"Capturar Foto"**.
4.  El sistema realizará las siguientes acciones:
    *   Comparará la foto capturada con las fotos de referencia de todos los colaboradores registrados.
    *   Si encuentra una coincidencia, identificará al colaborador.
    *   Verificará en la **Planificación** si el colaborador tiene un turno asignado para ese día.
    *   Consultará el último registro de asistencia:
        *   Si el último fue una "Entrada", registrará el evento actual como **"Salida"**.
        *   Si no hay registro o el último fue una "Salida", lo registrará como **"Entrada"**.
    *   Mostrará un mensaje de éxito en la pantalla.
5.  El registro aparecerá inmediatamente en la lista de **"Últimos Registros"**.

### 4. Consulta de Información (Módulo de Reportes)

Para analizar la asistencia y las horas trabajadas:

1.  Ve al módulo de **Reportes**.
2.  Utiliza los filtros en la parte superior:
    *   **Colaborador:** Selecciona un colaborador específico o "Todos".
    *   **Fecha de Inicio y Fin:** Define el período que deseas analizar.
3.  La tabla se actualizará automáticamente mostrando un resumen por colaborador:
    *   **Horas Programadas:** Total de horas según los turnos asignados en la planificación.
    *   **Horas Trabajadas:** Suma real de las horas entre los registros de entrada y salida.
    *   **Horas Extra:** La diferencia entre las horas trabajadas y las programadas.

---

## 🛠️ Tecnologías Utilizadas

-   **Frontend:** React, TypeScript, Tailwind CSS
-   **Backend y Base de Datos:** Supabase
-   **IA y Reconocimiento Facial:** Google Gemini API
