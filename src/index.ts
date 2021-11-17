import { GeoCoder } from './../../IEIBack/src/models/biblioteca.models';
// COMO ACTUAR ANTE DUPLICADOS
// EL CODIGOPROVINCIA/LOCALIDAD VIENE DEL CODIGO POSTAL? LO TENIAMOS MAL EN LA PLANTILLA?
import { BibliotecaModel, LocalidadModel, ProvinciumModel } from './../../IEIBack/src/models/biblioteca.models';
import { BibliotecaCV } from './cvmodel';
const fs = require('fs');
import path from "path";
const { Biblioteca, Localidad, Provincia } = require('../../IEIBack/src/sqldb');
const NodeGeocoder = require('node-geocoder');



const options = {
  provider: 'mapquest',

  apiKey: 'pViqJFOnVmpOCwqDbbcAAw4NSmY3IAWm', // for Mapquest, OpenCage, Google Premier
  // formatter: null // 'gpx', 'string', ...
};
const geocoder = NodeGeocoder(options);

// Using callback

async function getCoordinates(dir: string) {
  return await geocoder.geocode(dir);
}

export async function extractDataCV(rawData: BibliotecaCV[]) {
  console.log('Extracting CV_DATA')
  const provincias: ProvinciumModel[] = getProvincias(rawData);
  const localidades: LocalidadModel[] = getLocalidades(rawData);
  const bibliotecas: BibliotecaModel[] = await getBibliotecas(rawData);

  console.log('Populating CV_DATA');
  populateDB(provincias, localidades, bibliotecas);
}

function getProvincias(bibliotecas: BibliotecaCV[]): ProvinciumModel[] {
  let provincias: ProvinciumModel[] = [];

  bibliotecas.forEach(biblioteca => {
    const codPostal = biblioteca.CP;

    const provincia: ProvinciumModel = {
      nombreProvincia: biblioteca.NOM_PROVINCIA.slice(0, 1) + biblioteca.NOM_PROVINCIA.slice(1).toLowerCase(),
      codigoProvincia: codPostal.slice(0, 2)
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
      codigoLocalidad: codPostal.slice(2),
      nombreLocalidad: biblioteca.NOM_MUNICIPIO.slice(0, 1) + biblioteca.NOM_MUNICIPIO.slice(1).toLowerCase(),
      ProvinciumNombreProvincia: biblioteca.NOM_PROVINCIA.slice(0, 1) + biblioteca.NOM_PROVINCIA.slice(1).toLowerCase()
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

async function getBibliotecas(bibliotecas: BibliotecaCV[]): Promise<BibliotecaModel[]> {
  let bibliotecasRes: BibliotecaModel[] = [];

  const promise = await bibliotecas.map(async (biblioteca, index) => {
    const coordinates = await getCoordinates('España Comunidad Valenciana cp.' + biblioteca.CP + ' ' + biblioteca.NOM_MUNICIPIO + ' ' + biblioteca.DIRECCION)
    const bibliotecaParseada: BibliotecaModel = {
      nombre: biblioteca.NOMBRE,
      tipo: biblioteca.DESC_CARACTER === 'PÚBLICA' ? 'Pública' : 'Privada',
      direccion: biblioteca.DIRECCION,
      codigoPostal: biblioteca.CP.toString(),
      longitud: coordinates[0]?.longitude /* + biblioteca.lonwgs84 */,
      latitud: coordinates[0]?.latitude /* + biblioteca.latwgs84 */,
      telefono: biblioteca.TELEFONO.slice(5, 14),
      email: biblioteca.EMAIL,
      descripcion: biblioteca.TIPO,
      LocalidadNombreLocalidad: biblioteca.NOM_MUNICIPIO.slice(0, 1) + biblioteca.NOM_MUNICIPIO.slice(1).toLowerCase(),
    }
    bibliotecasRes.push(bibliotecaParseada)
  })
  await Promise.all(promise);
  return bibliotecasRes;
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

