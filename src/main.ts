import './scss/main.scss'

interface Request {
  code: string;
  clientCode: string;
  date: string;
  status: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  clientType: 'Фізична особа' | 'Юридична особа';
  startDate: string;
  endDate: string;
  serviceType: 'Технічне обслуговування' | 'Ремонт';
  attachments?: string[];
  executor?: string;
  priceEstimate?: number;
}

const BIN_ID = '682c54d68a456b7966a1c8c3';
const API_KEY = '$2a$10$0AOXojDkIORgxTm/qixBo.Z4yl44tO9.SlMRFYU0ZL7DqbzVqOysC';
const BIN_URL = `https://api.jsonbin.io/v3/b/682c54d68a456b7966a1c8c3`;

let requests: Request[] = [];


async function loadRequestsFromBin(): Promise<Request[]> {
  try {
    const res = await fetch(BIN_URL + '/latest', {
      headers: {
        'X-Master-Key': API_KEY,
      }
    });
    if (!res.ok) throw new Error('Не вдалося завантажити заявки');
    const data = await res.json();
    return data.record || [];
  } catch (error) {
    console.error('Помилка при завантаженні заявок:', error);
    return [];
  }
}


async function saveRequestsToBin(requests: Request[]) {
  try {
    const res = await fetch(BIN_URL, {
      method: 'PUT', // PUT повністю замінює bin, PATCH — оновлення частини
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': API_KEY,
      },
      body: JSON.stringify(requests),
    });
    if (!res.ok) throw new Error('Не вдалося зберегти заявки');
  } catch (error) {
    console.error('Помилка при збереженні заявок:', error);
  }
}


async function init() {
  requests = await loadRequestsFromBin();
  renderRequests();
}
init();


const form = document.querySelector('.application-form') as HTMLFormElement;

form?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const name = (document.getElementById('name') as HTMLInputElement).value;
  const address = (document.getElementById('address') as HTMLInputElement).value;
  const phone = (document.getElementById('phone') as HTMLInputElement).value;
  const email = (document.getElementById('email') as HTMLInputElement).value;
  const service = (document.getElementById('service') as HTMLSelectElement).value;
  const endDate = (document.getElementById('date') as HTMLInputElement).value;
  const fileInput = document.getElementById('file') as HTMLInputElement;

  const newRequest: Request = {
    code: Math.floor(100000 + Math.random() * 900000).toString(),
    clientCode: 'CL' + Math.floor(Math.random() * 10000),
    date: new Date().toISOString().split('T')[0],
    status: 'новий',
    name,
    email,
    phone,
    address,
    clientType: 'Фізична особа',
    startDate: new Date().toISOString().split('T')[0],
    endDate,
    serviceType: service as Request['serviceType'],
    attachments: fileInput?.files ? Array.from(fileInput.files).map(f => f.name) : [],
    executor: 'не призначено',
    priceEstimate: estimatePrice(service, endDate),
  };

  try {
    requests.push(newRequest);
    await saveRequestsToBin(requests);

    renderRequests();
    form.reset();
    alert('Заявка успішно збережена у JSONBin!');
  } catch (error) {
    alert('Помилка при збереженні заявки: ' + (error as Error).message);
  }
});


//приблизна вартість
const estimateButton = document.querySelector('.estimate-btn') as HTMLButtonElement;

estimateButton?.addEventListener('click', () => {
  const service = (document.getElementById('service') as HTMLSelectElement).value;
  const dateStr = (document.getElementById('date') as HTMLInputElement).value;

  if (!service || !dateStr) {
    alert('Будь ласка, оберіть тип обслуговування та дату завершення.');
    return;
  }

  const price = estimatePrice(service, dateStr);
  const output = document.getElementById('price-output') as HTMLElement;
  output.textContent = `Орієнтовна вартість: ${price} грн`;
});

function estimatePrice(serviceType: string, dateStr: string): number {
  const today = new Date();
  const endDate = new Date(dateStr);

  const diffTime = endDate.getTime() - today.getTime();
  const diffDays = Math.max(Math.ceil(diffTime / (1000 * 60 * 60 * 24)), 1);

  let basePrice = 0;

  switch (serviceType) {
    case 'Технічне обслуговування':
      basePrice = 800;
      break;
    case 'Ремонт':
      basePrice = 1500;
      break;
    default:
      return 0;
  }

  const urgencyFactor = Math.max(0, (7 - diffDays) * 0.2);
  const finalPrice = Math.round(basePrice * (1 + urgencyFactor));

  return finalPrice;
}

//фільтри
document.getElementById('code-input')?.addEventListener('input', filterRequests);
document.getElementById('start-date-input')?.addEventListener('input', filterRequests);
document.getElementById('status-input')?.addEventListener('input', filterRequests);

function filterRequests() {
  const code = (document.getElementById('code-input') as HTMLInputElement).value.toLowerCase();
  const startDate = (document.getElementById('start-date-input') as HTMLInputElement).value;
  const status = (document.getElementById('status-input') as HTMLInputElement).value.toLowerCase();

  const filtered = requests.filter(req =>
    (!code || req.code.includes(code)) &&
    (!startDate || req.startDate === startDate) &&
    (!status || req.status.toLowerCase().includes(status))
  );

  renderRequests(filtered);
}

function renderRequests(list: Request[] = requests) {
  const container = document.querySelector('.requests-display') as HTMLElement;
  container.innerHTML = '';

  list.forEach(req => {
    const card = document.createElement('div');
    card.className = 'request-card';

    card.innerHTML = `
      <p>Заявка: ${req.code}</p>
      <p>Дата початку робіт: ${req.startDate}</p>
      <p>Статус: ${req.status}</p>
      <p>Виконавець: ${req.executor}</p>
      <button class="update-button" data-code="${req.code}">Змінити</button>
    `;

    container.appendChild(card);
  });

  document.querySelectorAll('.update-button').forEach(button => {
    button.addEventListener('click', async () => {
      const code = (button as HTMLButtonElement).dataset.code!;
      const executor = prompt('Введіть імʼя нового виконавця:');
      if (executor) await updateExecutor(code, executor);
    });
  });
}


async function updateExecutor(code: string, newExecutor: string) {
  const req = requests.find(r => r.code === code);
  if (req) {
    req.executor = newExecutor;
    renderRequests();
    try {
      await saveRequestsToBin(requests);
    } catch (error) {
      alert('Помилка при збереженні виконавця: ' + (error as Error).message);
    }
  }
}
