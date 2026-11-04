# pericarp
lightweight tool for hooking things to timestamp ranges in HTML5 audio or video. 

inspired by the functions in popcornjs i used the most.

a pericarp is the tough, outer shell of a popcorn kernel, crucial for the popping process.

you invoke pericarp with 'let myCoolPericarpThing = new Pericarp(element)', where element points at an audio or video dom object, or with a query that will locate one, or with a PericarpClock object (which is like a time-based media element without a media element, it functions as an arbitrary clock you can bind events to).

assuming that your pericarp media thing is attached to a variable called __pericarp__, the below examples should work:

## pericarp.cue(args) 

will bind some functions to time events of your media. it can take 2-4 arguments!

### 2 arguments (startTime, startFn)

will run startFn at startTime (with some wiggle room because the timeUpdate listener isn't as precise as it might be);

### 3 arguments (startTime, endTime, startFn)

will trigger startFn if the time playhead is between startTime and endTime

### 4 arguments (startTime, endTime, startFn, endFn)

will trigger startFn if the time playhead is between start and end times, and will trigger endFn when the playhead leaves.

## pericarp.on(event, fn)

will trigger fn when the media event happens

## pericarp.once(event, fn)

like above, but only once.  (passing {once: true} to on as a third argument also works).


here's a very basic example that will make the annotation div visible between 5 and 10 seconds
```
...
<head>
<script src="pericarp.js"></script>
<style>
   #annotation { opacity: 0; transition: all 1s linear; }
</style>
</head>
<body>
<video src="vapormario.mp4" controls>
<div id="annotation">HWG with some hot doctor pepper! 🍿🍿🍿🍿🍿</div>

<script>
let video = document.querySelector("video")
let annotate = document.querySelector("#annotation")

let pericarp = new Pericarp("video");

//make our annotation visible between 5 & 10 seconds.
pericarp.cue(5,10,function(){
   //show it
   annotate.style.opacity = 1;
},function(){
   //hide it
   annotate.style.opacity = 0;
});

//when you get within 10 seconds from the end, go back to the beginning

pericarp.cue(video.duration - 10, video.duration, backToStart);  //you could also pass "100%" instead of video.duration

function backToStart(){
   video.currentTime = 0;
}

</script>
...
```
