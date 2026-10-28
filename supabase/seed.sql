-- Referrers ficticios para desarrollo. Se puede ejecutar sin duplicar emails.
insert into public.referrers (email, full_name)
values
  ('lucia.garcia@example.com', 'Lucía García'),
  ('mateo.rodriguez@example.com', 'Mateo Rodríguez'),
  ('sofia.martinez@example.com', 'Sofía Martínez'),
  ('santiago.lopez@example.com', 'Santiago López'),
  ('valentina.fernandez@example.com', 'Valentina Fernández'),
  ('nicolas.perez@example.com', 'Nicolás Pérez'),
  ('camila.gomez@example.com', 'Camila Gómez'),
  ('tomas.diaz@example.com', 'Tomás Díaz'),
  ('florencia.sanchez@example.com', 'Florencia Sánchez'),
  ('agustin.romero@example.com', 'Agustín Romero'),
  ('martina.torres@example.com', 'Martina Torres'),
  ('lucas.alvarez@example.com', 'Lucas Álvarez'),
  ('paula.ruiz@example.com', 'Paula Ruiz'),
  ('federico.ramirez@example.com', 'Federico Ramírez'),
  ('julieta.flores@example.com', 'Julieta Flores'),
  ('diego.acosta@example.com', 'Diego Acosta'),
  ('carolina.medina@example.com', 'Carolina Medina'),
  ('andres.herrera@example.com', 'Andrés Herrera'),
  ('victoria.silva@example.com', 'Victoria Silva'),
  ('gabriel.castro@example.com', 'Gabriel Castro')
on conflict (lower(email)) do nothing;
