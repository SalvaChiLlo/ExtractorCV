// COMO ACTUAR ANTE DUPLICADOS
// EL CODIGOPROVINCIA/LOCALIDAD VIENE DEL CODIGO POSTAL? LO TENIAMOS MAL EN LA PLANTILLA?
import { BibliotecaModel, LocalidadModel, ProvinciumModel } from './../../IEIBack/src/models/biblioteca.models';
import { BibliotecaCV } from './cvmodel';
const fs = require('fs');
import path from "path";
const { Biblioteca, Localidad, Provincia } = require('../../IEIBack/src/sqldb');

export function extractDataEUS(rawData: BibliotecaCV[]) {
  console.log('Extracting CV_DATA')

  const provincias: ProvinciumModel[] = getProvincias(rawData);
  const localidades: LocalidadModel[] = getLocalidades(rawData);
  const bibliotecas: BibliotecaModel[] = getBibliotecas(rawData);

  console.log('Populating CV_DATA');
  populateDB(provincias, localidades, bibliotecas);
}

function getProvincias(bibliotecas: BibliotecaCV[]): ProvinciumModel[] {
  let provincias: ProvinciumModel[] = [];

  bibliotecas.forEach(biblioteca => {
    const codPostal = biblioteca.CP;

    const provincia: ProvinciumModel = {
      nombreProvincia: biblioteca.NOM_PROVINCIA,
      codigoProvincia: biblioteca.COD_PROVINCIA.toString()
    }

    if (provincia.codigoProvincia && provincia.nombreProvincia) {
      provincias.push(provincia)
    }
  })

  const provinciasUnicas: ProvinciumModel[] = []

  provincias.forEach(provincia => {
    const repeated = provinciasUnicas.filter(provUnica => {
      return provUnica.codigoProvincia === provincia.codigoProvincia && provUnica.nombreProvincia === provincia.nombreProvincia
    })

    if (!repeated.length) {
      provinciasUnicas.push(provincia)
    }
  })

  return provinciasUnicas;
}

function getLocalidades(bibliotecas: BibliotecaCV[]): LocalidadModel[] {
  let localidades: LocalidadModel[] = [];

  bibliotecas.forEach(biblioteca => {
    const codPostal = biblioteca.CP

    const localidad: LocalidadModel = {
      codigoLocalidad: biblioteca.COD_MUNICIPIO.toString(),
      nombreLocalidad: biblioteca.NOM_MUNICIPIO,
      ProvinciumNombreProvincia: biblioteca.NOM_PROVINCIA
    }

    if (localidad.codigoLocalidad && localidad.nombreLocalidad && localidad.ProvinciumNombreProvincia) {
      localidades.push(localidad)
    }
  })
  const localidadesUnicas: LocalidadModel[] = []

  localidades.forEach(localidad => {
    const repeated = localidadesUnicas.filter(localUnica => {
      return localUnica.ProvinciumNombreProvincia === localidad.ProvinciumNombreProvincia
        &&
        localUnica.codigoLocalidad === localidad.codigoLocalidad
        &&
        localUnica.nombreLocalidad === localidad.nombreLocalidad
    })

    if (!repeated.length) {
      localidadesUnicas.push(localidad)
    }
  })

  return localidadesUnicas;
}

function getBibliotecas(bibliotecas: BibliotecaCV[]): BibliotecaModel[] {
  let bibliotecasRes: BibliotecaModel[] = [];

  bibliotecas.forEach(biblioteca => {
    const provincia: BibliotecaModel = {
      nombre: biblioteca.NOMBRE,
      tipo: 'Pública',
      direccion: biblioteca.DIRECCION,
      codigoPostal: biblioteca.CP.toString(),
      longitud: + biblioteca.lonwgs84,
      latitud: + biblioteca.latwgs84,
      telefono: biblioteca.TELEFONO.slice(4, 13),
      email: biblioteca.EMAIL,
      descripcion: biblioteca.TIPO,
      LocalidadNombreLocalidad: biblioteca.NOM_MUNICIPIO,
    }

    bibliotecasRes.push(provincia)
  })

  const bibliotecasUnicas: BibliotecaModel[] = []

  bibliotecasRes.forEach(biblioteca => {
    const repeated = bibliotecasUnicas.filter(bibliotecaUnica => {
      return bibliotecaUnica.nombre === biblioteca.nombre
    })

    if (!repeated.length) {
      bibliotecasUnicas.push(biblioteca)
    }
  })

  return bibliotecasUnicas;
}

function populateDB(provincias: ProvinciumModel[], localidades: LocalidadModel[], bibliotecas: BibliotecaModel[]) {
  Provincia.bulkCreate(
    provincias,
    {
      ignoreDuplicates: true
    }
  ).then(() => {
    console.log('SUCCESS POPULATING PROVINCIAS');
    Localidad.bulkCreate(
      localidades,
      {
        ignoreDuplicates: true
      }
    ).then(() => {
      console.log('SUCCESS POPULATING LOCALIDADES');
      Biblioteca.bulkCreate(
        bibliotecas,
        {
          updateOnDuplicate: [
            'tipo',
            'direccion',
            'codigoPostal',
            'longitud',
            'latitud',
            'telefono',
            'email',
            'descripcion',
          ]
        }
      ).then(() => {
        console.log('SUCCESS POPULATING BIBLIOTECAS');
      }).catch(console.log)
    }).catch(console.log)
  }).catch(console.log)
}
// extractData(JSON.parse(fs.readFileSync(path.join(__dirname, './bibliotecas.json')).toString()));

