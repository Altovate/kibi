/*eslint max-len: 0*/

/**
 * Defines the following objects:
 *
 * - a visualization with a searchSourceJSON
 */
module.exports = [
  {
    index: {
      _index: '.kibi',
      _type: 'visualization',
      _id: 'kibi1'
    }
  },
  {
    "kibanaSavedObjectMeta": {
      "searchSourceJSON": "{\"source\":{\"include\":\"rnews:articleBody\", \"exclude\":\"rnews:companyBody\"}}"
    }
  }
];
