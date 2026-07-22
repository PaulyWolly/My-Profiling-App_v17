const express = require('express');
const path = require('path');
const router = express.Router();
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');

const swaggerPath = path.join(__dirname, '..', 'swagger.yaml');
const swaggerDocument = YAML.load(swaggerPath);

router.use('/', swaggerUi.serve);
router.get('/', swaggerUi.setup(swaggerDocument, {
    customSiteTitle: 'My Profiling App v17 API'
}));

module.exports = router;
