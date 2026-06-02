const OPENMUR_BRAND = Object.freeze({
  id: "openmur",
  name: "open-mur",
  displayName: "openMur",
  productName: "openMur",
  appId: "com.openmur.app",
  desktopFile: "open-mur.desktop",
  dbusService: "com.openmur.App",
  dbusPath: "/com/openmur/App",
  dbusInterface: "com.openmur.App",
  gsettingsPrefix: "openmur",
  userDataDir: "openmur",
  flagsConfBasename: "open-mur",
});

function getAppBrand() {
  return OPENMUR_BRAND;
}

module.exports = {
  getAppBrand,
  OPENMUR_BRAND,
};
