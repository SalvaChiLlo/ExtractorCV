import { GeoCoder } from './../../IEIBack/src/models/biblioteca.models';
// COMO ACTUAR ANTE DUPLICADOS
// EL CODIGOPROVINCIA/LOCALIDAD VIENE DEL CODIGO POSTAL? LO TENIAMOS MAL EN LA PLANTILLA?
import { BibliotecaModel, LocalidadModel, ProvinciumModel } from './../../IEIBack/src/models/biblioteca.models';
import { BibliotecaCV } from './cvmodel';
const fs = require('fs');
import path from "path";
const { Biblioteca, Localidad, Provincia } = require('../../IEIBack/src/sqldb');
const NodeGeocoder = require('node-geocoder');
import { convertCSVToJSON } from "../../IEICV/src";
import { Builder, By, Key, until } from 'selenium-webdriver';
import { Options } from 'selenium-webdriver/chrome';

const options = {
  provider: 'mapquest',

  apiKey: 'pViqJFOnVmpOCwqDbbcAAw4NSmY3IAWm', // for Mapquest, OpenCage, Google Premier
  // formatter: null // 'gpx', 'string', ...
};
const geocoder = NodeGeocoder(options);

// Using callback

async function getCoordinates(dir: string) {
  const opts = new Options();
  opts.addArguments('--headless', 'window-size=1192,870', '--no-sandbox')
  opts.addArguments('--disable-rtc-smoothness-algorithm', '--disable-gpu-compositing', '--disable-gpu', '--force-device-scale-factor=1', '--disable-lcd-text')

  let driver = await new Builder().forBrowser('chrome').setChromeOptions(opts).build();

  try {
    await driver.get('https://www.coordenadas-gps.com/')
    // await driver.sleep(5000)
    const input = await driver.findElement({ id: 'address' })
    // await driver.sleep(5000)
    for (let index = 0; index < 300; index++) {
      await input.sendKeys(Key.BACK_SPACE)
    }
    // await driver.sleep(5000)
    await input.sendKeys(dir)
    await driver.manage().setTimeouts({ implicit: 10000 })
    // await driver.sleep(5000)

    const submit = await driver.findElement(By.xpath('//*[@id="wrap"]/div[2]/div[3]/div[1]/form[1]/div[2]/div/button'))
    await submit.click();
    await driver.sleep(5000)

    const latitude = await driver.findElement({ id: 'latitude' })
    const latitudeVal = await latitude.getAttribute("value")
    const longitude = await driver.findElement({ id: 'longitude' })
    const longitudeVal = await longitude.getAttribute("value")

    return [{
      latitude: latitudeVal,
      longitude: longitudeVal
    }];
  } catch (e: any) {
    console.log(e)
    return [{
      latitude: 0,
      longitude: 0
    }]
  }
  finally {
    await driver.close();
  }
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

  for (let index = 0; index < bibliotecas.length; index++) {
    const coordinates = await getCoordinates(`${bibliotecas[index].DIRECCION}, ${bibliotecas[index].CP} ${bibliotecas[index].NOM_MUNICIPIO}, España`)
    console.log(`${bibliotecas[index].DIRECCION}, ${bibliotecas[index].CP} ${bibliotecas[index].NOM_MUNICIPIO}, España`)
    console.log(coordinates)
    const bibliotecaParseada: BibliotecaModel = {
      nombre: bibliotecas[index].NOMBRE,
      tipo: bibliotecas[index].COD_CARACTER === 'PU' ? 'Pública' : 'Privada',
      direccion: bibliotecas[index].DIRECCION,
      codigoPostal: bibliotecas[index].CP.toString(),
      longitud: +coordinates[0]?.longitude /* + bibliotecas[index].lonwgs84 */,
      latitud: +coordinates[0]?.latitude /* + bibliotecas[index].latwgs84 */,
      telefono: bibliotecas[index].TELEFONO.slice(5, 14),
      email: bibliotecas[index].EMAIL,
      descripcion: bibliotecas[index].TIPO,
      LocalidadNombreLocalidad: bibliotecas[index].NOM_MUNICIPIO.slice(0, 1) + bibliotecas[index].NOM_MUNICIPIO.slice(1).toLowerCase(),
    }
    bibliotecasRes.push(bibliotecaParseada)
  }

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
            'nombre',
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

async function testExtractor() {
  const rawData = fs.readFileSync(path.join(__dirname, '../CV.csv')).toString();
  const parsedData = await convertCSVToJSON(rawData);
  extractDataCV(parsedData);
}

// testExtractor();