const defaults = {
	spread: 180,
	ticks: 100,
	gravity: 1,
	decay: 0.94,
	startVelocity: 30,
	colors: ["#a864fd", "#29cdff", "#78ff44", "#ff718d", "#fdff6a"],
};

function shootLeft() {
	confetti({
		...defaults,
		particleCount: 30,
		scalar: 1.2,
		shapes: ["circle", "square", "heart"],
		origin: { x: 0, y: 0.5 },
		angle: 0,
	});

	confetti({
		...defaults,
		particleCount: 20,
		scalar: 1.5,
		shapes: ["circle", "square", "heart"],
		origin: { x: 0, y: 0.5 },
		angle: 0,
	});
}

function shootRight() {
	confetti({
		...defaults,
		particleCount: 30,
		scalar: 1.2,
		shapes: ["circle", "square", "heart"],
		origin: { x: 1, y: 0.5 },
		angle: 180,
	});

	confetti({
		...defaults,
		particleCount: 20,
		scalar: 1.5,
		shapes: ["circle", "square", "heart"],
		origin: { x: 1, y: 0.5 },
		angle: 180,
	});
}

function shoot() {
	if (!document.getElementById("confettiCheckbox").checked) return;
	setTimeout(shootLeft, 0);
	setTimeout(shootLeft, 100);
	setTimeout(shootLeft, 200);

	setTimeout(shootRight, 0);
	setTimeout(shootRight, 100);
	setTimeout(shootRight, 200);
}

shoot();
setInterval(shoot, 3000);
