const reveals = document.querySelectorAll('.reveal');

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('show');
      }
    });
  },
  { threshold: 0.16 }
);

reveals.forEach((el, index) => {
  el.style.transitionDelay = `${index * 120}ms`;
  observer.observe(el);
});

document.getElementById('year').textContent = new Date().getFullYear();
