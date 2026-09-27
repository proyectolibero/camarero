/**
 * Entorno de tests.
 *
 * Zona horaria fija para que las fechas derivadas sean deterministas,
 * y raiz de memoria apuntando a un directorio inexistente para que ningun test
 * que olvide pasar su propio root pueda escribir en la memoria real.
 */
process.env["TZ"] = "UTC"
process.env["CAMARERO_MEMORY_ROOT"] = "/ruta/inexistente/no-usar-en-tests"
