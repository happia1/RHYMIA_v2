INSERT INTO public.users (id, email, provider)
VALUES ('10976cf9-dee3-49b8-bb4d-926cb505bf88', 'happia1@nate.com', 'email')
ON CONFLICT (id) DO NOTHING;
