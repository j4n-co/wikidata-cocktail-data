const request = require('request-promise-native');
const throttledRequest = require('throttled-request')(request);
const fs = require('fs');
const _ = require('lodash');
const COCKTAILS = [];
const COCKTIAL_INGREDIENTS = [];
const INGREDIENTS = [];
const WD_QUERY_URL = 'https://query.wikidata.org/sparql?format=json&query=';
const SPARQL_QUERY = `
SELECT
DISTINCT
?cocktail ?cocktailLabel ?cocktailDescription ?image
?cocktailLink ?ingredient ?ingredientLabel WHERE {
  ?cocktail (wdt:P31?/wdt:P279*) wd:Q134768.
  ?cocktail (wdt:P186|wdt:P527) ?ingredient.
  OPTIONAL { ?cocktail wdt:P18 ?image. }
  ?cocktailLink schema:about ?cocktail.
  ?cocktailLink schema:isPartOf <https://en.wikipedia.org/>.
  MINUS { ?ingredient (wdt:P31?/wdt:P279?/wdt:P527*) wd:Q23392. }
  MINUS { ?ingredient (wdt:P31?/wdt:P279*) wd:Q11469. }
  MINUS { ?ingredient (wdt:P31?/wdt:P279*) wd:Q81727. }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}`;
const SQARQL_REQUEST_URL = WD_QUERY_URL + encodeURIComponent(SPARQL_QUERY);

throttledRequest.configure({
	requests: 5,
	milliseconds: 1000
})


function createThumbnailUrl(url) {
	if (url) {
		const imageName = url.match(/([^/]+)$/)[0];
		const thumbnailSize = '800';
		const thumbUrl = `http://commons.wikimedia.org/w/index.php?title=Special:FilePath&file=${imageName}&width=${thumbnailSize}`;
		return thumbUrl;
	}
	return '/static/cocktail-placeholder.svg';
}
const extractIDFromURL = url => url.split('/')[url.split('/').length - 1];

function populateDB(results) {

	results.forEach((result) => {
	  COCKTAILS.push({
		id: extractIDFromURL(result.cocktail.value),
		label: result.cocktailLabel.value,
		description: (result.cocktailDescription) ? result.cocktailDescription.value : '',
		link: result.cocktailLink.value,
		image: (result.image) ? createThumbnailUrl(result.image.value) : false,
	  });

	   INGREDIENTS.push({
		id: extractIDFromURL(result.ingredient.value),
		label: result.ingredientLabel.value,
	  });

	  COCKTIAL_INGREDIENTS.push({
		cocktail_id: extractIDFromURL(result.cocktail.value),
		ingredient_id: extractIDFromURL(result.ingredient.value),
	  });
	});
  }

function resolveImageUrls( cocktails ){
	cocktails.forEach(cocktail => {
		if (cocktail.image) {
			throttledRequest(cocktail.image).pipe(fs.createWriteStream(`public/${cocktail.label}.jpg`))
		}
	})
}

request({ url: SQARQL_REQUEST_URL })
.then( response => {
	const results = JSON.parse(response).results.bindings;
	return populateDB(results)
})
.then( () => {
	return dataObj = {
		cocktails: _.uniqWith(COCKTAILS, _.isEqual),
		ingredients: _.uniqWith(INGREDIENTS, _.isEqual),
		cocktailIngredients: _.uniqWith(COCKTIAL_INGREDIENTS, _.isEqual)
	}
} )
.then( dataObj => {
	fs.writeFile("public/data.json", JSON.stringify(dataObj));
	resolveImageUrls(dataObj.cocktails)
} )