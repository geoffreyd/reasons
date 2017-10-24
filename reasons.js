(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.Reasons = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict'

const Utils = require('./Utils')
const maxWidth = 200
const padding = 10
const fontSize = 16


module.exports = {
  mixin, isEdge, isNode, save
}


/**
 * Mixes in the behaviour of an Element to an Object
 */
function mixin(element) {
  element.isEdge = isEdge
  element.isNode = isNode
  element.export = save
  init(element)
  return element
}


/**
 * Initialize an Element
 *  @params element Node or Edge
 */
function init (element) {
  element.id = element.id || Math.random().toString(36).slice(-5)

  if (element.isEdge()) {

    /** 
     * Default Edge values:
     *  From should return ['node_id', 'node_id'] 
     *  To should return 'node_id'
     *  Path should be an empty array to be set in the View/UI
     */
    element.from = Utils.flatten([element.from]).map((from) => { return from.id || from })
    element.to = element.to.id || element.to
    element.type = element.type || 'supports'
    element.paths = []
  } else {

    //  Default Node values
    element.text = element.text || 'A reason'
    element.width = maxWidth
    element.height = fontSize * 3.5
    element.x1 = element.x || 0
    element.y1 = element.y || 0
    element.x2 = element.x1 + element.width
    element.y2 = element.y1 + element.height
  }
}


/**
 * Returns true if an element is an Edge
 */
function isEdge () {
  return (this.to && this.from) ? true : false
}


/**
 * Returns true if an element is a Node
 */
function isNode () {
  return (this.isEdge()) ? false : true
}


/**
 * Exports an element's data
 */
function save () {
  if (this.isEdge()) {

    //  Export an Edge
    return {
      id: this.id,
      type: this.type,
      from: convertObjectsToIds(this.from),
      to: convertObjectsToIds(this.to)
    }
  } else {

    //  Export a Node
    return {
      id: this.id, 
      text: this.text,
      x: this.x1,
      y: this.y1
    }    
  }
}

/**
 * Helper function to ensure permit edge references to both nodes and node.ids
 */
 function convertObjectsToIds (obj) {
  if (obj instanceof Array) {
    return obj.map(el => el.id || el)
  } else {
    return obj.id || obj    
  }
}
},{"./Utils":2}],2:[function(require,module,exports){
module.exports = {

  //  build a DOM element
  buildNode: function (type, options, attributes) {
    const node = document.createElement(type)
    for (var key in options) {
      node[key] = options[key]
    }
    for (var key in attributes) {
      node.setAttribute(key, attributes[key])
    }
    return node
  },

  intersection: function (array1, array2) {
    return array1.filter(function(n) {
      return array2.indexOf(n) !== -1;
    })
  },

  unique: require('array-unique'),
  flatten: require('array-flatten'),
  diff: require('array-difference')
}
},{"array-difference":11,"array-flatten":12,"array-unique":13}],3:[function(require,module,exports){
arguments[4][1][0].apply(exports,arguments)
},{"./Utils":2,"dup":1}],4:[function(require,module,exports){
'use strict'

const Utils = require('./utils')
const Element = require('./element')

module.exports = Graph


/**
 * A Graph is simply an extended array containing node and edge objects.
 *  It is an abstract data structure with no DOM form.
 *  Edges will contain references to node objects.
 *
 * @param elements  the elements (nodes & edges) to consitute the graph
 */
function Graph(elements) {

  //  sort the elements so nodes are added before edges
  if (elements instanceof Array) {
    elements.sort((a,b) => {
      return a.to ? -1: 1 
    }).forEach(el => this.add(el))
  }
}


/**  
 * Use Array as the prototype
 */
Graph.prototype = Object.create(Array.prototype)


/**
 * Adds a new element to the Graph.
 *  Nodes should be added before edges as the latter referrence the former
 *
 * @param element an element to add
 */
Graph.prototype.add = function (element) {

  //  Mixin Element behaviour
  Element.mixin(element)

  if (element.isNode()) {
    this.unshift(element)
  } else {

    //  Edges can connect independent or conjoined reasons. 
    //  If A B & C both already support D
    //  and a new edge is added from A to B or vice versa
    //  then the relationships should be merged [A,B] -> D
    //  and C -> D kept unchanged  
    let commonChildren = Utils.intersection(
      Utils.flatten(element.from.map(e => this.children(e))), 
      this.children(element.to)
    ).map(el => el.id)

    if (commonChildren.length > 0) {
      let commonParents = Utils.flatten([element.from, element.to]).map(el => el.id || el)

      //  remove the edge that contains element.from to common children
      this.edges().forEach((edge) => {
        if (Utils.intersection(element.from, edge.from).length > 0)
          this.remove(edge)

        if (edge.from.includes(element.to)) {
          this.push({
            from: Utils.flatten([edge.from, element.from]),
            to: edge.to,
            type: edge.type
          })
          this.remove(edge)
        }
      })
    } else {
      this.push(element)  
    }
  }
}


/**
 * Removes an existing element from the Graph.
 *  If a node is removed, it should also remove relevent edges
 *
 *  @param el the element to remove
 */
 Graph.prototype.remove = function (el) {
  let i = this.indexOf(el)

  if (i > -1) {

    if (el.isNode()) {

      //  find associated edges first
      let edges = this.edges().filter(edge => edge.to == el.id || edge.from.includes(el.id))

      //  determine if any associated edge is conjoined
      let conjoined = edges.filter(edge => edge.from.length > 1)

      //  remove the node
      this.splice(i, 1)

      //  and then the associated edges
      edges.forEach((edge) => {
        this.splice(this.indexOf(edge), 1)
      })

      //  also remove node from any complex relations
      this.edges().filter(e => e.from instanceof Array).map((e) => {
        e.from.splice(e.from.indexOf(el), 1)
        if (e.from.length ==1) e.from = e.from[0]
      })

      //  and now modify the conjoined edges and add them back
      conjoined.forEach((edge) => {
        edge.from.splice(edge.from.indexOf(el.id), 1)
        this.push(edge)
      })
    } else {
      this.splice(i, 1)
    }  
  }

  //  permit chaining during tests
  return this
}


/**
 * Moves an element to the front of the Graph.  Useful for assiting with
 * layouts.
 *
 * @param el an element to focus
 */
 Graph.prototype.focus = function (el) {
  let index = this.indexOf(el)
  if (index > -1) {
    this.push(this.splice(index, 1)[0])
  }

  //  permit chaining during tests
  return this
}


/**
 * Returns an array of all the Graph's edges
 */
 Graph.prototype.edges = function () {
  return this.filter(el => el.from && el.to)
}


/**
 * Returns an array of all the Graph's nodes
 */
Graph.prototype.nodes = function () {
  return this.filter(el => !el.from || !el.to )
}


/**
 * Returns an array of all the Graph's elements
 */
Graph.prototype.elements = function () {
  return this
}


/**
 * Find all the parents for a given node or id
 *  Returns an array of objects
 *
 *  @params id a Node or String id of a Node
 */
Graph.prototype.parents = function (id) {
  if (id instanceof Object) id = id.id

  return Utils.flatten(
      this.edges().filter(el => el.to == id).map(el => el.from)
    ).map(el => this.find(i => i.id == el))
}


/**
 * Find all the children for a given node or id
 *  Returns an array of objects
 *
 *  @params id a Node or String id of a Node
 */
Graph.prototype.children = function (id) {
  if (id instanceof Object) id = id.id

  return Utils.unique(this.edges().filter((el) => {
    return Utils.flatten([el.from]).map(el => el.id || el).indexOf(id) > -1
  }).map(el => el.to)
    .map(el => this.find(i => i == el || i.id == el)))
}
},{"./element":3,"./utils":9}],5:[function(require,module,exports){
const Utils = require('./utils')
const MAP_URL = 'http://dave.kinkead.com.au/reasons'
const reasons = []

module.exports = Highlighter

function Highlighter (dom) {
  if (!(this instanceof Highlighter)) return new Highlighter(dom)

  buildToolTip()

  //  Event listener for text highlight
  const target = document.querySelector(dom)
  target.addEventListener('mouseup', (event) => {
    const selection = document.getSelection()
    const tooltip = document.querySelector('#tooltip')
    
    if (selection.focusOffset - selection.anchorOffset > 0) {
      const offset = window.scrollY
      const rect = selection.getRangeAt(0).getBoundingClientRect()

      //  set some default styling
      tooltip.setAttribute('style', 'position:absolute; display:block; top:'+(rect.top+offset-40)+'px; left:'+(rect.left+rect.width/2-tooltip.offsetWidth/2)+'px; background-color:#FFF; border-radius: 3px; box-shadow: 2px 2px 5px 3px rgba(0,0,0,0.2); height: 34px;')
    } else {
      tooltip.setAttribute('style', 'display:none;')
    }
  })
}

function buildToolTip () {

  const tooltip = Utils.buildNode('div', {id: 'tooltip'}, {style: 'display:none;'})
  document.body.appendChild(tooltip)

  const premise = Utils.buildNode('img', {name: 'premise', title: 'Premise', src: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAMAAADXqc3KAAAANlBMVEUAAABERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERER5ECNjAAAAEXRSTlMAAQYUIyYtLjlLVVZxoLzt7xYSs+QAAABUSURBVCjPzZA5EsAgDMSW+0oA//+zDDCksZt0qFupsoGDzaUkDYahSeXBr0A8hKtCbCRQNTqJJMieyu+Q8crBQrmweLbYw5tbn3hwyzce1Ly0x28PkhUQ+2QwVtEAAAAASUVORK5CYII="})
  premise.setAttribute('style', 'padding:5px;')
  premise.addEventListener('click', addReason)

  const objection = Utils.buildNode('img', {name: 'objection', title: 'Objection', src: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAMAAADXqc3KAAAAgVBMVEUAAABERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERER4EtaNAAAAKnRSTlMAAQMFBgcJDEdLWFlbXF1odXeFiIuRkpSVl5itr7m6vsfIytXX4ubo6f1TzZtTAAAAr0lEQVQoz22Q1xaCQAxEZ6mKBStiwS7q/P8H+rAlAdmn5N6zJ5kAQPleGoQ3areRrVYkD8EUJJvIc3JvhFtTksoUrjsCH1eyNsLJBAuKEX4GTB26R6iuMTrGv1sMDBnH/0zgPXMXDhiZ+80Ux0T9qM0w12ba28qb2V8Oa+Yyt2PGsmcmW2+AVu2v8iSodC6z8/cEoqaT15pXDmfkDpXnQHTiRd1nzWfu61SfB6kBgB9Z7jbscyDPiwAAAABJRU5ErkJggg=="})
  objection.setAttribute('style', 'padding:5px;')
  objection.addEventListener('click', addReason)

  const conclusion = Utils.buildNode('img', {name: 'conclusion', title: 'Conclusion', src: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAMAAADXqc3KAAAAaVBMVEUAAABERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERdclAKAAAAInRSTlMAAQIDBQcLDhEUHCYnKSowQEFCQ2JjZGaOlNrg4u3x9/v9hyAg+QAAAHVJREFUKFO1y0kSgkAQRNEPKoo44Ag4Yef9D+mCDoKedvJ39TIKZm27jnsjs4+7ZA5xl75L3++SJL0XAFnu+6cEKB79zvrN8ZdkqtDzp2QXx1kNl6m4Og5nu3Sew0WTJj7+BA6nhI9L4FAnHOqEw7HdRP0P/QCyxRQBq+KXRQAAAABJRU5ErkJggg=="})
  conclusion.setAttribute('style', 'padding:5px;')
  conclusion.addEventListener('click', addReason)

  tooltip.appendChild(premise)
  tooltip.appendChild(objection)
  tooltip.appendChild(conclusion)

  const button = Utils.buildNode('input', {id: 'create-map-button'}, {
    name: 'create-map-button',
    type: 'submit',
    value: 'Create Map'
  })

  button.onclick = () => {
    sessionStorage.setItem('reasons', JSON.stringify(reasons))
    window.open(MAP_URL, '_blank')  
  }

  document.body.appendChild(button)  
}

function addReason(event) {

  document.querySelector('#create-map-button').setAttribute('style', 'position:fixed;bottom:2rem;right:2rem;padding:1rem;border:1px solid #CCC;border-radius:3px;display:block')
  document.querySelector('#tooltip').setAttribute('style', 'display:none')

  const paragraph = document.getSelection()
  const selection = {
    type: event.target.name,
    text: paragraph.anchorNode.nodeValue.substring(paragraph.anchorOffset, paragraph.focusOffset)
  }
  
  reasons.push(selection)
}
},{"./utils":9}],6:[function(require,module,exports){
'use strict'

const Graph = require('./graph')
const UI = require('./ui')
const View = require('./view')


/**
 * This module wraps the DOM UI, Canvas renderer, and Graph data
 */
module.exports = Mapper


/**
 * The Map acts as the UI between the Graph data object and the browser DOM.
 * It is responsible for handling all mouse and keyboard events, and sending 
 * changes in the argument map to the Graph object.
 *
 * The Map contains references to @graph (the data) and @DOM (the DOM object)
 *
 * @params elementID  the element id to append the map canvas to
 */
function Mapper (elementID) {

  //  get the DOM element
  this.DOM = document.querySelector(elementID)

  //  attach the canvas to the HTML if the reference was valid
  if (this.DOM)
    View.init(this)
}


/**
 * Populates a Graph with nodes and edges.
 *
 * @params elements   the elements to render
 */
Mapper.prototype.render = function (elements) {
  this.graph = new Graph(elements)
  View.draw(this)
}


/**
 * Exports a Graph's data structure as an Array
 */
Mapper.prototype.export = function () {
  return this.graph.map(element => element.export())
}
},{"./graph":4,"./ui":8,"./view":10}],7:[function(require,module,exports){
//  Reasons.js by Dave Kinkead
//  Copyright (c) 2017 University of Queensland
//  Available under the MIT license

//  Reasons.js API

const Mapper = require('./mapper')
const Highlighter = require('./highlighter')

module.exports = {
  mapper: function (dom) {
    return new Mapper(dom)
  },

  highlight: function(dom) {
    return new Highlighter(dom)
  }
}
},{"./highlighter":5,"./mapper":6}],8:[function(require,module,exports){
'use strict'

module.exports = {}
},{}],9:[function(require,module,exports){
arguments[4][2][0].apply(exports,arguments)
},{"array-difference":11,"array-flatten":12,"array-unique":13,"dup":2}],10:[function(require,module,exports){
'use strict'

const Element = require('./Element')
const Utils = require('./utils')

const maxWidth = 200
const padding = 10
const fontSize = 16

let graph = {}

/**
 * Singleton View module to render a canvas.
 */
module.exports = (function () {
  
  /**
   * Initialise the view for this argument map instance 
   *  by appending a HTML canvas element.
   *
   *  @params mapper  The argument map to provide a view for
   */
  function init (argument) {
    let domBB = argument.DOM.getBoundingClientRect()
    let canvas = Utils.buildNode(
      'canvas', 
      {id: 'reasons-'+argument.DOM.id}, 
      {width: domBB.width, height: domBB.height}
    )

    argument.DOM.appendChild(canvas)
    argument.context = canvas.getContext('2d')
  }


  /**
   * Render an argument map instance
   */
  function draw (argument) {
    graph = argument.graph

    argument.graph.elements().map((el) => {
      if (el.isNode()) draw_node(el, argument.context)
      if (el.isEdge()) draw_edge(el, argument.context)
    })

  }

  return {
    init,
    draw
  }

})();


function draw_node (node, context) {

  //  word wrap the text 
  let text = wordWrap(node.text, context)

  //  recalculate the height
  let height = text.length * fontSize + fontSize * 2.5
  resize(node)

  //  clear a white rectangle for background
  context.clearRect(node.x1, node.y1, node.width, node.height)  

  //  draw a solid rounded border
  let cornerRadius = 4
  let rgb = '0,0,0'
  let opacity = 0.5
  if (node.hovering) opacity = 0.75
  if (node.selected) opacity = 0.9
  context.strokeStyle = 'rgba('+rgb+','+opacity+')'
  context.lineJoin = "round"
  context.lineWidth = cornerRadius
  context.strokeRect(
    node.x1+cornerRadius/2, node.y1+cornerRadius/2, 
    node.width-cornerRadius, node.height-cornerRadius
  )

  //  set text box styles
  context.fillStyle = 'rgba(0,0,0,0.8)'
  context.font = '16px sans-serif'
  context.textAlign = 'center'

  //  add the text content
  text.forEach((line, i) => {
    context.fillText(line, node.x1 + node.width/2, node.y1  + (i+2) * fontSize)
  })  
}

function draw_edge (edge, context) {
  locate(edge)

  //  stroke style
  let rgb = '0,0,0'
  let opacity = 0.5
  if (edge.hovering) opacity = 0.75
  if (edge.selected) opacity = 0.9
  context.strokeStyle = 'rgba('+rgb+','+opacity+')'
  context.lineWidth = 4

  //  stroke position
  context.beginPath()
  edge.paths.forEach((path) => {
    context.moveTo(path.x1, path.y1)
    context.lineTo(path.x2, path.y2)    
  })

  //  arrow tip
  let last = edge.paths[edge.paths.length-1]
  let arrow = arrowify(last)
  context.lineTo(arrow.x1, arrow.y1)
  context.moveTo(last.x2, last.y2)
  context.lineTo(arrow.x2, arrow.y2)
  context.stroke()

  //  text stroke
  let textWidth = context.measureText(edge.type).width + 5
  context.clearRect(edge.center.x-textWidth/2, edge.center.y-15, textWidth, 20)

  //  label
  context.fillStyle = 'rgba(0,0,0,0.8)'
  context.font = '14px sans-serif'
  context.textAlign = 'center'
  context.fillText(edge.type, edge.center.x, edge.center.y) 

  if (edge.intersection)
    context.fillRect(edge.intersection.x, edge.intersection.y, 10, 10)
}

//  Returns a list of `paths` between nodes for this relation
function locate (edge) {

  //  find the weighted center point
  let ids = Utils.flatten([edge.from, edge.to])
  let elements = graph.filter((el) => {
    return ids.includes(el.id)
  })

  edge.center = elements.map((el) => {
      return {x: (el.x1+(el.width)/2), y: (el.y1+(el.height )/2)}
    }).reduce((acc, el) => {
      return {x: acc.x + el.x, y: acc.y + el.y}
    })
  edge.center.x = parseInt(edge.center.x/(elements.length))
  edge.center.y = parseInt(edge.center.y/(elements.length))


  //  create paths between from and to elements
  if (edge.from instanceof Array) {

    //  create pairs from from-points to center to to-point
    edge.paths = edge.from.map((el) => {
      return {
        x1: parseInt(el.x1+(el.x2-el.x1)/2),
        y1: parseInt(el.y1+(el.y2-el.y1)/2),
        x2: parseInt(edge.center.x),
        y2: parseInt(edge.center.y)
      }
    })

    //  move the 'to' point back down the path to just outside the node.
    let offset = pointOfIntersection(edge.center, edge.to, 5)

    // get offset x,y from rectangle intersect
    edge.paths.push({
      x1: parseInt(edge.center.x),
      y1: parseInt(edge.center.y),
      x2: parseInt(edge.to.x1+(edge.to.x2-edge.to.x1)/2)-offset.x,
      y2: parseInt(edge.to.y1+(edge.to.y2-edge.to.y1)/2)+offset.y 
    })
  } else {

    //  when only a single from element exists
    let offset = pointOfIntersection(edge.center, edge.to, 5)

    edge.paths = [{
      x1: parseInt(edge.from.x1+(edge.from.x2-edge.from.x1)/2),
      y1: parseInt(edge.from.y1+(edge.from.y2-edge.from.y1)/2),
      x2: parseInt(edge.to.x1+(edge.to.x2-edge.to.x1)/2)-offset.x,
      y2: parseInt(edge.to.y1+(edge.to.y2-edge.to.y1)/2)+offset.y 
    }]
  }
}

function resize (node) {
  node.x2 = node.x1 + node.width
  node.y2 = node.y1 + node.height
}

function wordWrap(text, context) {
  let words = text.split(' ')
  let lines = []
  let line = ''

  words.forEach((word) => {
    let width = context.measureText(line + ' ' + word).width

    if (width < (maxWidth - padding * 2) ) {
      line += ' ' + word
    } else { 
      lines.push(line)
      line = word
    }
  })

  lines.push(line)
  return lines
}

//  Helper function to make arrow tips
function arrowify(path) {
  let angle = Math.atan2(path.y1-path.y2, path.x1-path.x2)
  return {
    x1: path.x2 + 10*Math.cos(angle+0.5),
    y1: path.y2 + 10*Math.sin(angle+0.5),
    x2: path.x2 + 10*Math.cos(angle-0.5),
    y2: path.y2 + 10*Math.sin(angle-0.5)    
  }
}

//  determines the intersection x,y from a point to center of rectangle
//  TODO: Add tests
function pointOfIntersection (from, rect, buffer) {
  let center = {x: rect.x1 + rect.width/2, y: rect.y1 + rect.height/2}

  //  determine the angle of the path
  let angle = Math.atan2(from.y - center.y, center.x - from.x)
  let absCos = Math.abs(Math.cos(angle))
  let absSin = Math.abs(Math.sin(angle))  

  let distance = (rect.width/2*absSin <= rect.height/2*absCos) ? rect.width/2/absCos : rect.height/2/absSin
  distance += buffer || 0

  return {x: distance * Math.cos(angle), y: distance * Math.sin(angle)}
}
},{"./Element":1,"./utils":9}],11:[function(require,module,exports){
(function(global) {

	var indexOf = Array.prototype.indexOf || function(elem) {
		var idx, len;

		if (this == null) {
			throw new TypeError("indexOf called on null or undefined");
		}

		for (idx = 0, len = this.length; idx < len; ++idx) {
			if (this[idx] === elem) {
				return idx;
			}
		}

		return -1;
	};

	function difference(a, b) {
		var idx, len;
		var res = [];

		for (idx = 0, len = a.length; idx < len; ++idx) {
			if (indexOf.call(b, a[idx]) === -1) {
				res.push(a[idx]);
			}
		}
		for (idx = 0, len = b.length; idx < len; ++idx) {
			if (indexOf.call(a, b[idx]) === -1) {
				res.push(b[idx]);
			}
		}
		return res;
	}

	if (typeof module === "object" && module.exports) {
		module.exports = difference;
	} else if (typeof define === "function" && define.amd) {
		define(function() {
			return difference;
		});
	} else {
		global.difference = difference;
	}

}(this));

},{}],12:[function(require,module,exports){
'use strict'

/**
 * Expose `arrayFlatten`.
 */
module.exports = flatten
module.exports.from = flattenFrom
module.exports.depth = flattenDepth
module.exports.fromDepth = flattenFromDepth

/**
 * Flatten an array.
 *
 * @param  {Array} array
 * @return {Array}
 */
function flatten (array) {
  if (!Array.isArray(array)) {
    throw new TypeError('Expected value to be an array')
  }

  return flattenFrom(array)
}

/**
 * Flatten an array-like structure.
 *
 * @param  {Array} array
 * @return {Array}
 */
function flattenFrom (array) {
  return flattenDown(array, [])
}

/**
 * Flatten an array-like structure with depth.
 *
 * @param  {Array}  array
 * @param  {number} depth
 * @return {Array}
 */
function flattenDepth (array, depth) {
  if (!Array.isArray(array)) {
    throw new TypeError('Expected value to be an array')
  }

  return flattenFromDepth(array, depth)
}

/**
 * Flatten an array-like structure with depth.
 *
 * @param  {Array}  array
 * @param  {number} depth
 * @return {Array}
 */
function flattenFromDepth (array, depth) {
  if (typeof depth !== 'number') {
    throw new TypeError('Expected the depth to be a number')
  }

  return flattenDownDepth(array, [], depth)
}

/**
 * Flatten an array indefinitely.
 *
 * @param  {Array} array
 * @param  {Array} result
 * @return {Array}
 */
function flattenDown (array, result) {
  for (var i = 0; i < array.length; i++) {
    var value = array[i]

    if (Array.isArray(value)) {
      flattenDown(value, result)
    } else {
      result.push(value)
    }
  }

  return result
}

/**
 * Flatten an array with depth.
 *
 * @param  {Array}  array
 * @param  {Array}  result
 * @param  {number} depth
 * @return {Array}
 */
function flattenDownDepth (array, result, depth) {
  depth--

  for (var i = 0; i < array.length; i++) {
    var value = array[i]

    if (depth > -1 && Array.isArray(value)) {
      flattenDownDepth(value, result, depth)
    } else {
      result.push(value)
    }
  }

  return result
}

},{}],13:[function(require,module,exports){
/*!
 * array-unique <https://github.com/jonschlinkert/array-unique>
 *
 * Copyright (c) 2014-2015, Jon Schlinkert.
 * Licensed under the MIT License.
 */

'use strict';

module.exports = function unique(arr) {
  if (!Array.isArray(arr)) {
    throw new TypeError('array-unique expects an array.');
  }

  var len = arr.length;
  var i = -1;

  while (i++ < len) {
    var j = i + 1;

    for (; j < arr.length; ++j) {
      if (arr[i] === arr[j]) {
        arr.splice(j--, 1);
      }
    }
  }
  return arr;
};

module.exports.immutable = function uniqueImmutable(arr) {
  if (!Array.isArray(arr)) {
    throw new TypeError('array-unique expects an array.');
  }

  var arrLen = arr.length;
  var newArr = new Array(arrLen);

  for (var i = 0; i < arrLen; i++) {
    newArr[i] = arr[i];
  }

  return module.exports(newArr);
};

},{}]},{},[7])(7)
});